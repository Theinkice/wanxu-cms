/**
 * 管理 REST API 全量（/api/admin/*，除 login 外均需 Cookie 会话鉴权）
 * 资源：认证 / 分类 / 产品 / 文章 / 轮播 / 页面文案 / 询盘 / 上传
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppVariables, Bindings, Product } from '../types';
import { fail, ok, parsePage } from '../lib/http';
import { ADMIN_COOKIE, requireModuleRole } from '../middleware/auth';
import { getDevQuestion, requireDevChallenge } from '../lib/devChallenge';
import { checkRateLimit } from '../lib/rateLimit';
import { isDangerousSvg, verifyMagicBytes } from '../lib/fileVerify';
import { sendPasswordResetEmail } from '../lib/mailer';
import {
  AdminUserRepo,
  ArticleRepo,
  AuthService,
  BannerRepo,
  CategoryRepo,
  HomeSectionRepo,
  InquiryRepo,
  MediaRepo,
  NavRepo,
  PageContentRepo,
  PagesRepo,
  ProductRepo,
  SettingsRepo,
  TagRepo,
} from '../lib/repo';
import {
  isValidHomeSectionKey,
  isValidPageContentKey,
  validateAdminUser,
  validateArticle,
  validateBanner,
  validateCategory,
  validateChangePassword,
  validateForgotPassword,
  validateHomeSection,
  validateLogin,
  validateNavItem,
  validatePage,
  validatePageContent,
  validateProduct,
  validateResetPassword,
  validateSettings,
  validateTag,
} from '../lib/validate';

type C = Context<{ Bindings: Bindings; Variables: AppVariables }>;

export const adminApi = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 天（秒）

async function readJson(c: C): Promise<Record<string, unknown> | null> {
  try {
    const raw = await c.req.json();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** JSON 字符串字段安全解析 */
function parseJsonArr(raw: string): unknown[] {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 规范化 tag_ids 入参为数字数组 */
function normalizeTagIds(raw: unknown): number[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === 'string' ? Number.parseInt(x, 10) : Number(x)))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseJsonObj(raw: string): Record<string, unknown> {
  try {
    const obj = JSON.parse(raw || '{}');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 产品出参：images / params JSON 字符串 → 数组，便于后台编辑 */
function productOut(p: Product): Record<string, unknown> {
  const images = parseJsonArr(p.images).filter((x): x is string => typeof x === 'string');
  return { ...p, images, params_zh: parseJsonArr(p.params_zh), params_en: parseJsonArr(p.params_en) };
}

/** 模块级 RBAC：不满足最低角色等级返回 403 */
function guardModule(c: C, module: string): Response | null {
  const admin = c.get('admin');
  if (!requireModuleRole(admin.role, module)) {
    return fail(403, '权限不足：当前管理员等级无权访问该模块', 403);
  }
  return null;
}

/** 模块级角色中间件（super_admin 专属模块由 authMiddleware 路径前缀兜底） */
const roleMw = (module: string) => async (c: C, next: () => Promise<void>) => {
  const denied = guardModule(c, module);
  if (denied) return denied;
  await next();
};

adminApi.use('/banners', roleMw('banners'));
adminApi.use('/page-contents', roleMw('home-content'));
adminApi.use('/home-sections', roleMw('home-content'));
adminApi.use('/categories', roleMw('categories'));
adminApi.use('/products', roleMw('products'));
adminApi.use('/pages', roleMw('pages'));
adminApi.use('/upload', roleMw('media'));
adminApi.use('/media', roleMw('media'));
adminApi.use('/articles', roleMw('articles'));
adminApi.use('/inquiries', roleMw('inquiries'));
adminApi.use('/tags', roleMw('tags'));

// ================================================================ 认证

adminApi.post('/login', async (c) => {
  // 登录频率限制：同 IP 5 分钟最多 5 次失败/尝试
  const limit = await checkRateLimit(c, { prefix: 'login', windowSec: 300, maxRequests: 5 });
  if (!limit.allowed) {
    return fail(429, '请求过于频繁，请稍后再试', 429);
  }

  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateLogin(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });

  const result = await AuthService.login(c.env.DB, value.username, value.password);
  if (!result) return fail(401, '用户名或密码错误', 401);

  // 注意：ok()/fail() 返回新建 Response，hono setCookie 写入的 c.res 头会丢失，
  // 因此直接在最终 Response 上追加 Set-Cookie
  const secure = new URL(c.req.url).protocol === 'https:';
  const res = ok({ username: result.admin.username, role: result.admin.role });
  res.headers.append(
    'Set-Cookie',
    `${ADMIN_COOKIE}=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure ? '; Secure' : ''}`,
  );
  return res;
});

adminApi.post('/logout', async (c) => {
  const token = getCookie(c, ADMIN_COOKIE);
  if (token) await AuthService.logout(c.env.DB, token);
  const res = ok(null, '已登出');
  res.headers.append(
    'Set-Cookie',
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return res;
});

adminApi.get('/me', (c) => {
  const admin = c.get('admin');
  return ok({ username: admin.username, role: admin.role });
});

/** 修改密码（双重确认：旧密码 + 两次一致的新密码）；登录态下任意角色可用 */
adminApi.post('/change-password', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateChangePassword(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  const admin = c.get('admin');
  const result = await AuthService.changePassword(
    c.env.DB,
    admin.id,
    value.old_password,
    value.new_password,
  );
  if (!result.ok) return fail(400, result.reason || '修改失败', 400);
  return ok(null, '密码已修改');
});

// ================================================================ 分类

adminApi.get('/categories', async (c) => {
  return ok(await CategoryRepo.list(c.env.DB));
});

adminApi.post('/categories', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateCategory(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  const id = await CategoryRepo.create(c.env.DB, value);
  return ok({ id });
});

adminApi.put('/categories/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await CategoryRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '分类不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateCategory(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  await CategoryRepo.update(c.env.DB, id, value);
  return ok({ id });
});

adminApi.delete('/categories/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await CategoryRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '分类不存在', 404);
  if (await CategoryRepo.hasProducts(c.env.DB, id)) {
    return fail(409, '该分类下存在产品，无法删除', 409);
  }
  await CategoryRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ================================================================ 产品

adminApi.get('/products', async (c) => {
  const { page, pageSize } = parsePage(
    { page: c.req.query('page'), pageSize: c.req.query('pageSize') },
    20,
  );
  const catRaw = Number.parseInt(c.req.query('category_id') ?? '', 10);
  const data = await ProductRepo.listAdmin(c.env.DB, {
    page,
    pageSize,
    categoryId: Number.isFinite(catRaw) && catRaw > 0 ? catRaw : undefined,
    status: c.req.query('status'),
    q: c.req.query('q') ?? undefined,
  });
  return ok({ ...data, items: data.items.map(productOut) });
});

adminApi.get('/products/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const product = await ProductRepo.findById(c.env.DB, id);
  if (!product) return fail(404, '产品不存在', 404);
  const tagIds = await TagRepo.getTagIdsFor(c.env.DB, 'product_tags', id);
  return ok({ ...productOut(product), tag_ids: tagIds });
});

adminApi.post('/products', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateProduct(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  if (!(await CategoryRepo.findById(c.env.DB, value.category_id))) {
    return fail(400, '所属分类不存在', 400, { errors: { category_id: '所属分类不存在' } });
  }
  const id = await ProductRepo.create(c.env.DB, value);
  await TagRepo.setTagsFor(c.env.DB, 'product_tags', id, normalizeTagIds(body.tag_ids));
  return ok({ id });
});

adminApi.put('/products/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await ProductRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '产品不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateProduct(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  if (!(await CategoryRepo.findById(c.env.DB, value.category_id))) {
    return fail(400, '所属分类不存在', 400, { errors: { category_id: '所属分类不存在' } });
  }
  await ProductRepo.update(c.env.DB, id, value);
  await TagRepo.setTagsFor(c.env.DB, 'product_tags', id, normalizeTagIds(body.tag_ids));
  return ok({ id });
});

adminApi.patch('/products/:id/status', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await ProductRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '产品不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const isActive = Number(body.is_active) === 1;
  await ProductRepo.setStatus(c.env.DB, id, isActive);
  return ok({ id, is_active: isActive ? 1 : 0 });
});

adminApi.delete('/products/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await ProductRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '产品不存在', 404);
  await ProductRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ================================================================ 文章

adminApi.get('/articles', async (c) => {
  const { page, pageSize } = parsePage(
    { page: c.req.query('page'), pageSize: c.req.query('pageSize') },
    20,
  );
  const data = await ArticleRepo.listAdmin(c.env.DB, {
    page,
    pageSize,
    status: c.req.query('status'),
    q: c.req.query('q') ?? undefined,
  });
  return ok(data);
});

adminApi.get('/articles/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const article = await ArticleRepo.findById(c.env.DB, id);
  if (!article) return fail(404, '文章不存在', 404);
  const tagIds = await TagRepo.getTagIdsFor(c.env.DB, 'article_tags', id);
  return ok({ ...article, tag_ids: tagIds });
});

adminApi.post('/articles', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateArticle(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  const id = await ArticleRepo.create(c.env.DB, value);
  await TagRepo.setTagsFor(c.env.DB, 'article_tags', id, normalizeTagIds(body.tag_ids));
  return ok({ id });
});

adminApi.put('/articles/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await ArticleRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '文章不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateArticle(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  await ArticleRepo.update(c.env.DB, id, value);
  await TagRepo.setTagsFor(c.env.DB, 'article_tags', id, normalizeTagIds(body.tag_ids));
  return ok({ id });
});

adminApi.delete('/articles/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await ArticleRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '文章不存在', 404);
  await ArticleRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ================================================================ 轮播

adminApi.get('/banners', async (c) => {
  return ok(await BannerRepo.list(c.env.DB));
});

adminApi.post('/banners', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateBanner(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  const id = await BannerRepo.create(c.env.DB, value);
  return ok({ id });
});

adminApi.put('/banners/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await BannerRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '轮播不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateBanner(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  await BannerRepo.update(c.env.DB, id, value);
  return ok({ id });
});

adminApi.delete('/banners/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await BannerRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '轮播不存在', 404);
  await BannerRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ============================================================= 页面文案

adminApi.get('/page-contents', async (c) => {
  return ok(await PageContentRepo.list(c.env.DB));
});

adminApi.put('/page-contents/:key', async (c) => {
  const key = c.req.param('key');
  if (!isValidPageContentKey(key)) {
    return fail(400, '无效的页面文案 key', 400);
  }
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validatePageContent(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  await PageContentRepo.upsert(c.env.DB, key, value);
  return ok({ key });
});

// ============================================================= 首页区块

adminApi.get('/home-sections', async (c) => {
  const list = await HomeSectionRepo.listAdmin(c.env.DB);
  return ok(list.map((s) => ({
    ...s,
    items: parseJsonArr(s.items),
    config: parseJsonObj(s.config),
  })));
});

adminApi.put('/home-sections/:key', async (c) => {
  const key = c.req.param('key');
  if (!isValidHomeSectionKey(key)) {
    return fail(400, '无效的首页区块 key', 400);
  }
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateHomeSection(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  await HomeSectionRepo.update(c.env.DB, key, value);
  return ok({ key });
});

// ============================================================= 页面管理

adminApi.get('/pages', async (c) => {
  const { page, pageSize } = parsePage(
    { page: c.req.query('page'), pageSize: c.req.query('pageSize') },
    20,
  );
  const data = await PagesRepo.listAdminPaged(c.env.DB, {
    page,
    pageSize,
    q: c.req.query('q') ?? undefined,
  });
  return ok(data);
});

adminApi.get('/pages/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const page = await PagesRepo.findById(c.env.DB, id);
  if (!page) return fail(404, '页面不存在', 404);
  const tagIds = await TagRepo.getTagIdsFor(c.env.DB, 'page_tags', id);
  return ok({ ...page, tag_ids: tagIds });
});

adminApi.post('/pages', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validatePage(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  if (await PagesRepo.findBySlug(c.env.DB, value.slug)) {
    return fail(409, '该 URL 标识已被占用', 409, { errors: { slug: '该 URL 标识已被占用' } });
  }
  const id = await PagesRepo.create(c.env.DB, value);
  await TagRepo.setTagsFor(c.env.DB, 'page_tags', id, normalizeTagIds(body.tag_ids));
  return ok({ id });
});

adminApi.put('/pages/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await PagesRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '页面不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validatePage(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  const clash = await PagesRepo.findBySlug(c.env.DB, value.slug);
  if (clash && clash.id !== id) {
    return fail(409, '该 URL 标识已被占用', 409, { errors: { slug: '该 URL 标识已被占用' } });
  }
  await PagesRepo.update(c.env.DB, id, value);
  await TagRepo.setTagsFor(c.env.DB, 'page_tags', id, normalizeTagIds(body.tag_ids));
  return ok({ id });
});

adminApi.delete('/pages/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await PagesRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '页面不存在', 404);
  await PagesRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ================================================================ 询盘

adminApi.get('/inquiries', async (c) => {
  const { page, pageSize } = parsePage(
    { page: c.req.query('page'), pageSize: c.req.query('pageSize') },
    20,
  );
  const data = await InquiryRepo.list(c.env.DB, {
    page,
    pageSize,
    read: c.req.query('read'),
  });
  const unread = await InquiryRepo.unreadCount(c.env.DB);
  return ok({ ...data, unread });
});

adminApi.get('/inquiries/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const inquiry = await InquiryRepo.findById(c.env.DB, id);
  if (!inquiry) return fail(404, '询盘不存在', 404);
  return ok(inquiry);
});

adminApi.patch('/inquiries/:id/read', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await InquiryRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '询盘不存在', 404);
  const body = await readJson(c);
  const isRead = body ? Number(body.is_read) === 1 : true;
  await InquiryRepo.markRead(c.env.DB, id, isRead);
  return ok({ id, is_read: isRead ? 1 : 0 });
});

adminApi.delete('/inquiries/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await InquiryRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '询盘不存在', 404);
  await InquiryRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ================================================================ 上传 / 文件管理

/** 常用文件类型 MIME → 扩展名（不在白名单中的类型会被拒绝） */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/json': 'json',
};
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_EXTS = new Set(Object.values(MIME_TO_EXT));

function safeExtFromFilename(filename: string): string | null {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  return ext && ALLOWED_EXTS.has(ext) ? ext : null;
}

function resolveUploadExt(file: File): string | null {
  return MIME_TO_EXT[file.type] ?? safeExtFromFilename(file.name);
}

adminApi.post('/upload', async (c) => {
  const form = await c.req.parseBody();
  const file = form['file'];
  if (!(file instanceof File)) {
    return fail(400, '缺少上传文件（字段名 file）', 400);
  }
  const ext = resolveUploadExt(file);
  if (!ext) {
    return fail(415, '不支持的文件类型', 415);
  }

  // 先按大小拒绝，避免大文件触发后续内容校验
  if (file.size > UPLOAD_MAX_BYTES) {
    return fail(413, '文件大小不能超过 20MB', 413);
  }

  // 安全加固：拒绝 SVG 上传（可内嵌脚本），并校验图片文件真实魔数
  if (isDangerousSvg(file, ext)) {
    return fail(415, 'SVG 文件因存在脚本执行风险，禁止直接上传；请转换为 PNG/JPG/WEBP 后上传', 415);
  }
  if (!(await verifyMagicBytes(file, ext))) {
    return fail(415, '文件内容与实际扩展名不符，请上传真实格式的文件', 415);
  }
  const d = new Date();
  const key = `uploads/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });
  const url = `/media/${key}`;
  try {
    await MediaRepo.create(c.env.DB, {
      url,
      filename: file.name || key.split('/').pop() || '',
      mime_type: file.type || 'application/octet-stream',
      size: file.size,
    });
  } catch {
    // 文件记录写入失败不影响上传返回
  }
  return ok({ url });
});

// ================================================================ 标签

adminApi.get('/tags', async (c) => {
  return ok(await TagRepo.list(c.env.DB));
});

adminApi.post('/tags', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateTag(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  if (await TagRepo.findBySlug(c.env.DB, value.slug)) {
    return fail(409, '该 URL 标识已被占用', 409, { errors: { slug: '该 URL 标识已被占用' } });
  }
  const id = await TagRepo.create(c.env.DB, value);
  return ok({ id });
});

adminApi.put('/tags/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await TagRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '标签不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateTag(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  const clash = await TagRepo.findBySlug(c.env.DB, value.slug);
  if (clash && clash.id !== id) {
    return fail(409, '该 URL 标识已被占用', 409, { errors: { slug: '该 URL 标识已被占用' } });
  }
  await TagRepo.update(c.env.DB, id, value);
  return ok({ id });
});

adminApi.delete('/tags/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await TagRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '标签不存在', 404);
  await TagRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ================================================================ 文件管理（原媒体库）

adminApi.get('/media', async (c) => {
  const { page, pageSize } = parsePage(
    { page: c.req.query('page'), pageSize: c.req.query('pageSize') },
    40,
  );
  const q = (c.req.query('q') ?? '').trim();
  const type = (c.req.query('type') ?? 'all').trim();
  return ok(await MediaRepo.list(c.env.DB, page, pageSize, q || undefined, type || undefined));
});

adminApi.delete('/media/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await MediaRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '文件不存在', 404);
  await MediaRepo.delete(c.env.DB, id);
  // 同时尝试从 R2 删除对象（路径为 /media/uploads/... 去掉前缀）
  try {
    const key = existing.url.replace(/^\/media\//, '');
    if (key) await c.env.BUCKET.delete(key);
  } catch {
    // 忽略 R2 删除失败
  }
  return ok(null, '已删除');
});

// ================================================================ 导航
// 以下三个模块仅 super_admin 可访问（authMiddleware 路径前缀兜底）

adminApi.get('/nav', async (c) => {
  return ok(await NavRepo.listAdmin(c.env.DB));
});

/** 导航批量排序：body { ids: [按新顺序排列的导航项 id] } */
adminApi.put('/nav/reorder', async (c) => {
  const body = await readJson(c);
  if (!body || !Array.isArray(body.ids)) {
    return fail(400, '缺少 ids 数组', 400);
  }
  const ids = (body.ids as unknown[]).map((x) => Number.parseInt(String(x), 10)).filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return fail(400, 'ids 为空', 400);
  const db = c.env.DB;
  for (let i = 0; i < ids.length; i++) {
    await db.prepare('UPDATE nav_items SET sort_order = ? WHERE id = ?').bind(i + 1, ids[i]).run();
  }
  return ok(null, '已更新排序');
});

adminApi.post('/nav', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateNavItem(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  const id = await NavRepo.create(c.env.DB, value);
  return ok({ id });
});

adminApi.put('/nav/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await NavRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '导航项不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateNavItem(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  await NavRepo.update(c.env.DB, id, value);
  return ok({ id });
});

adminApi.delete('/nav/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await NavRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '导航项不存在', 404);
  await NavRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});

// ================================================================ 站点设置

adminApi.get('/settings', async (c) => {
  return ok(await SettingsRepo.getAll(c.env.DB));
});

adminApi.put('/settings', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);

  // 仅当开发者信息字段真正发生变化时才需要回答验证问题
  const current = await SettingsRepo.getAll(c.env.DB);
  const devKeys = Object.keys(body).filter((k) => k.startsWith('dev_'));
  const isDevChange = devKeys.some((k) => String(body[k] ?? '') !== String(current[k] ?? ''));
  let challenge: { ok: boolean; message?: string; cookie?: string } = { ok: true };
  if (isDevChange) {
    challenge = await requireDevChallenge(c, body);
    if (!challenge.ok) {
      return fail(403, challenge.message || '请先正确回答开发者验证问题', 403);
    }
  }

  const { errors, value } = validateSettings(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  await SettingsRepo.setMany(c.env.DB, value);
  const res = ok(null, '已保存');
  if (challenge.cookie) res.headers.append('Set-Cookie', challenge.cookie);
  return res;
});

// ================================================================ 开发者验证

adminApi.get('/dev-challenge', async (c) => {
  const admin = c.get('admin');
  if (admin.role !== 'super_admin') {
    return fail(403, '权限不足：该功能仅超级管理员可用', 403);
  }
  return ok({ question: getDevQuestion(c.env) });
});

adminApi.post('/dev-challenge', async (c) => {
  const admin = c.get('admin');
  if (admin.role !== 'super_admin') {
    return fail(403, '权限不足：该功能仅超级管理员可用', 403);
  }
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const challenge = await requireDevChallenge(c, body);
  if (!challenge.ok) {
    return fail(403, challenge.message || '请先正确回答开发者验证问题', 403);
  }
  const res = ok(null, '验证通过');
  if (challenge.cookie) res.headers.append('Set-Cookie', challenge.cookie);
  return res;
});

/** 找回密码：通过用户名+邮箱请求重置链接 */
adminApi.post('/forgot-password', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateForgotPassword(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });

  // 始终返回相同提示，避免枚举用户名/邮箱是否存在
  const admin = await AdminUserRepo.findByUsernameAndEmail(c.env.DB, value.username, value.email);
  if (admin) {
    const token = await AuthService.createPasswordResetToken(c.env.DB, admin.id);
    const adminPath = (c.env.ADMIN_PATH?.trim() || '/admin').replace(/\/$/, '') || '/admin';
    const resetPath = `${adminPath}/#reset-password?token=${encodeURIComponent(token)}`;
    const resetUrl = new URL(resetPath, c.env.SITE_URL).toString();
    await sendPasswordResetEmail(c.env, admin.email, resetUrl);
  }

  return ok(null, '如果用户名与邮箱匹配，重置链接已发送至该邮箱');
});

/** 重置密码：使用邮件中的令牌设置新密码 */
adminApi.post('/reset-password', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateResetPassword(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });

  const result = await AuthService.resetPassword(c.env.DB, value.token, value.new_password);
  if (!result.ok) return fail(400, result.reason || '重置失败', 400);
  return ok(null, '密码已重置，请使用新密码登录');
});

// ================================================================ 管理员

adminApi.get('/admins', async (c) => {
  return ok(await AdminUserRepo.list(c.env.DB));
});

adminApi.post('/admins', async (c) => {
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateAdminUser(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });
  if (!value.password) return fail(400, '新建管理员必须设置密码', 400, { errors: { password: '新建管理员必须设置密码' } });
  if (await AdminUserRepo.findByUsername(c.env.DB, value.username)) {
    return fail(409, '用户名已存在', 409, { errors: { username: '用户名已存在' } });
  }
  if (value.email && (await AdminUserRepo.findByEmail(c.env.DB, value.email))) {
    return fail(409, '邮箱已存在', 409, { errors: { email: '邮箱已存在' } });
  }
  const id = await AdminUserRepo.create(c.env.DB, value);
  return ok({ id });
});

adminApi.put('/admins/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await AdminUserRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '管理员不存在', 404);
  const body = await readJson(c);
  if (!body) return fail(400, '请求体格式错误', 400);
  const { errors, value } = validateAdminUser(body);
  if (Object.keys(errors).length > 0) return fail(400, '参数校验失败', 400, { errors });

  // 保护：不能降级/删除最后一位超级管理员
  if (existing.role === 'super_admin' && value.role !== 'super_admin') {
    if ((await AdminUserRepo.countSuperAdmins(c.env.DB)) <= 1) {
      return fail(409, '系统至少需要保留一位超级管理员', 409);
    }
  }
  // 保护：邮箱唯一
  if (value.email && (await AdminUserRepo.findByEmail(c.env.DB, value.email, id))) {
    return fail(409, '邮箱已存在', 409, { errors: { email: '邮箱已存在' } });
  }
  if (value.username && (await AdminUserRepo.findByUsername(c.env.DB, value.username, id))) {
    return fail(409, '用户名已存在', 409, { errors: { username: '用户名已存在' } });
  }
  // 保护：不允许删除/改动当前登录账号本身之外——允许改自己密码，但不可改自己角色为低于 super_admin？保持简单：仅保护最后一位超管
  await AdminUserRepo.update(c.env.DB, id, value);
  return ok({ id });
});

adminApi.delete('/admins/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return fail(400, '无效的 ID', 400);
  const existing = await AdminUserRepo.findById(c.env.DB, id);
  if (!existing) return fail(404, '管理员不存在', 404);
  const current = c.get('admin');
  if (existing.id === current.id) {
    return fail(409, '不能删除当前登录的账号', 409);
  }
  if (existing.role === 'super_admin' && (await AdminUserRepo.countSuperAdmins(c.env.DB)) <= 1) {
    return fail(409, '系统至少需要保留一位超级管理员', 409);
  }
  await AdminUserRepo.delete(c.env.DB, id);
  return ok(null, '已删除');
});
