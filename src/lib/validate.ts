/**
 * 轻量字段校验（不引入 zod）
 * 约定：每个 validateXxx 返回 { errors, value }；errors 为空对象即通过
 * value 为去首尾空格、补默认值后的净数据
 */

import type {
  AdminUserInput,
  ArticleInput,
  BannerInput,
  CategoryInput,
  CmsPageInput,
  HomeSectionInput,
  InquiryInput,
  NavItemInput,
  PageContentInput,
  ProductInput,
  TagInput,
} from '../types';

export type FieldErrors = Record<string, string>;

export interface ValidationOutcome<T> {
  errors: FieldErrors;
  value: T;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function rawStr(v: unknown, maxLen: number): string {
  // 富文本字段：只截断长度，不去除内部空白
  if (typeof v !== 'string') return '';
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function int(v: unknown, def: number): number {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : def;
}

/** 询盘校验（服务端二次校验） */
export function validateInquiry(body: Record<string, unknown>): ValidationOutcome<InquiryInput> {
  const errors: FieldErrors = {};
  const value: InquiryInput = {
    name: str(body.name, 100),
    email: str(body.email, 200),
    company: str(body.company, 200),
    country: str(body.country, 100),
    message: rawStr(body.message, 2000).trim(),
    product_ref: str(body.product_ref, 200),
  };
  if (!value.name) errors.name = '姓名必填';
  if (!value.email) errors.email = '邮箱必填';
  else if (!EMAIL_RE.test(value.email)) errors.email = '邮箱格式不正确';
  if (!value.message) errors.message = '留言内容必填';
  return { errors, value };
}

/** 登录校验 */
export function validateLogin(body: Record<string, unknown>): ValidationOutcome<{ username: string; password: string }> {
  const errors: FieldErrors = {};
  const value = {
    username: str(body.username, 100),
    password: typeof body.password === 'string' ? body.password : '',
  };
  if (!value.username) errors.username = '用户名必填';
  if (!value.password) errors.password = '密码必填';
  return { errors, value };
}

/** 分类校验 */
export function validateCategory(body: Record<string, unknown>): ValidationOutcome<CategoryInput> {
  const errors: FieldErrors = {};
  const value: CategoryInput = {
    name_zh: str(body.name_zh, 100),
    name_en: str(body.name_en, 100),
    subtitle_zh: str(body.subtitle_zh, 200),
    subtitle_en: str(body.subtitle_en, 200),
    cover_image: str(body.cover_image, 500),
    sort_order: int(body.sort_order, 0),
  };
  if (!value.name_zh) errors.name_zh = '中文名称必填';
  if (!value.name_en) errors.name_en = '英文名称必填';
  return { errors, value };
}

/** 产品校验（images 入参为字符串数组，净数据存 JSON 字符串） */
export function validateProduct(body: Record<string, unknown>): ValidationOutcome<ProductInput> {
  const errors: FieldErrors = {};
  let imagesArr: string[] = [];
  if (Array.isArray(body.images)) {
    imagesArr = body.images
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x.length > 0 && x.length <= 500)
      .slice(0, 30);
  }
  const isActive = int(body.is_active, 1) === 0 ? 0 : 1;
  const value: ProductInput = {
    category_id: int(body.category_id, 0),
    name_zh: str(body.name_zh, 200),
    name_en: str(body.name_en, 200),
    summary_zh: rawStr(body.summary_zh, 500),
    summary_en: rawStr(body.summary_en, 500),
    description_zh: rawStr(body.description_zh, 100000),
    description_en: rawStr(body.description_en, 100000),
    main_image: str(body.main_image, 500),
    images: JSON.stringify(imagesArr),
    sizes: str(body.sizes, 300),
    sizes_en: str(body.sizes_en, 300),
    colors: str(body.colors, 300),
    colors_en: str(body.colors_en, 300),
    params_zh: JSON.stringify(normalizeParams(body.params_zh)),
    params_en: JSON.stringify(normalizeParams(body.params_en)),
    seo_title_zh: str(body.seo_title_zh, 200),
    seo_title_en: str(body.seo_title_en, 200),
    seo_description_zh: rawStr(body.seo_description_zh, 500),
    seo_description_en: rawStr(body.seo_description_en, 500),
    sort_order: int(body.sort_order, 0),
    is_active: isActive,
  };
  if (!value.category_id || value.category_id < 1) errors.category_id = '所属分类必选';
  if (!value.name_zh) errors.name_zh = '中文名称必填';
  if (!value.name_en) errors.name_en = '英文名称必填';
  return { errors, value };
}

/** 文章校验 */
export function validateArticle(body: Record<string, unknown>): ValidationOutcome<ArticleInput> {
  const errors: FieldErrors = {};
  const statusRaw = str(body.status, 20);
  const value: ArticleInput = {
    title_zh: str(body.title_zh, 200),
    title_en: str(body.title_en, 200),
    summary_zh: rawStr(body.summary_zh, 500),
    summary_en: rawStr(body.summary_en, 500),
    content_zh: rawStr(body.content_zh, 100000),
    content_en: rawStr(body.content_en, 100000),
    cover_image: str(body.cover_image, 500),
    seo_title_zh: str(body.seo_title_zh, 200),
    seo_title_en: str(body.seo_title_en, 200),
    seo_description_zh: rawStr(body.seo_description_zh, 500),
    seo_description_en: rawStr(body.seo_description_en, 500),
    status: statusRaw === 'published' ? 'published' : 'draft',
  };
  if (!value.title_zh) errors.title_zh = '中文标题必填';
  if (!value.title_en) errors.title_en = '英文标题必填';
  return { errors, value };
}

/** 轮播校验 */
export function validateBanner(body: Record<string, unknown>): ValidationOutcome<BannerInput> {
  const errors: FieldErrors = {};
  const value: BannerInput = {
    image: str(body.image, 500),
    title_zh: str(body.title_zh, 200),
    title_en: str(body.title_en, 200),
    subtitle_zh: str(body.subtitle_zh, 300),
    subtitle_en: str(body.subtitle_en, 300),
    link: str(body.link, 500),
    sort_order: int(body.sort_order, 0),
  };
  if (!value.image) errors.image = '轮播图片必传';
  return { errors, value };
}

/** 页面文案校验 */
export function validatePageContent(body: Record<string, unknown>): ValidationOutcome<PageContentInput> {
  const errors: FieldErrors = {};
  const value: PageContentInput = {
    content_zh: rawStr(body.content_zh, 100000),
    content_en: rawStr(body.content_en, 100000),
    image: str(body.image, 500),
  };
  return { errors, value };
}

/** 页面文案 key 白名单 */
export const PAGE_CONTENT_KEYS = ['home_story', 'home_about', 'contact_info'] as const;

export function isValidPageContentKey(key: string): boolean {
  return (PAGE_CONTENT_KEYS as readonly string[]).includes(key);
}

/** 外贸参数规范化：入参为 [{key,value}]（或 JSON 字符串），出参为净化的键值对数组 */
export function normalizeParams(input: unknown): { key: string; value: string }[] {
  let arr: unknown = input;
  if (typeof input === 'string') {
    try {
      arr = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: { key: string; value: string }[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const k = str(o.key, 100);
    const v = str(o.value, 500);
    if (k) out.push({ key: k, value: v });
    if (out.length >= 50) break;
  }
  return out;
}

/** 导航项校验 */
export function validateNavItem(body: Record<string, unknown>): ValidationOutcome<NavItemInput> {
  const errors: FieldErrors = {};
  const value: NavItemInput = {
    parent_id: int(body.parent_id, 0),
    label_zh: str(body.label_zh, 100),
    label_en: str(body.label_en, 100),
    url: str(body.url, 500),
    sort_order: int(body.sort_order, 0),
    is_active: int(body.is_active, 1) === 0 ? 0 : 1,
  };
  if (!value.label_zh) errors.label_zh = '中文名称必填';
  if (!value.label_en) errors.label_en = '英文名称必填';
  if (!value.url) errors.url = '链接地址必填';
  else if (!value.url.startsWith('/') && !/^https?:\/\//.test(value.url)) {
    errors.url = '链接须为站内路径（/开头）或完整 http(s) 地址';
  }
  return { errors, value };
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** 自定义页面校验 */
export function validatePage(body: Record<string, unknown>): ValidationOutcome<CmsPageInput> {
  const errors: FieldErrors = {};
  const slug = str(body.slug, 100).toLowerCase();
  const value: CmsPageInput = {
    slug,
    title_zh: str(body.title_zh, 200),
    title_en: str(body.title_en, 200),
    content_zh: rawStr(body.content_zh, 200000),
    content_en: rawStr(body.content_en, 200000),
    cover_image: str(body.cover_image, 500),
    seo_title_zh: str(body.seo_title_zh, 200),
    seo_title_en: str(body.seo_title_en, 200),
    seo_description_zh: rawStr(body.seo_description_zh, 500),
    seo_description_en: rawStr(body.seo_description_en, 500),
    is_active: int(body.is_active, 1) === 0 ? 0 : 1,
    sort_order: int(body.sort_order, 0),
  };
  if (!value.slug) errors.slug = 'URL 标识必填';
  else if (!SLUG_RE.test(value.slug)) errors.slug = 'URL 标识仅支持小写字母、数字与中划线，且须以字母或数字开头';
  else if (RESERVED_SLUGS.has(value.slug)) errors.slug = '该 URL 标识为系统保留，请更换';
  if (!value.title_zh) errors.title_zh = '中文标题必填';
  if (!value.title_en) errors.title_en = '英文标题必填';
  return { errors, value };
}

/** 标签校验 */
export function validateTag(body: Record<string, unknown>): ValidationOutcome<TagInput> {
  const errors: FieldErrors = {};
  const slug = str(body.slug, 100).toLowerCase();
  const value: TagInput = {
    name_zh: str(body.name_zh, 100),
    name_en: str(body.name_en, 100),
    slug,
    sort_order: int(body.sort_order, 0),
  };
  if (!value.name_zh) errors.name_zh = '中文名称必填';
  if (!value.name_en) errors.name_en = '英文名称必填';
  if (!value.slug) errors.slug = 'URL 标识必填';
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(value.slug)) errors.slug = 'URL 标识仅支持小写字母、数字与中划线';
  return { errors, value };
}

/** 系统保留 slug（与内置路由冲突） */
const RESERVED_SLUGS = new Set(['products', 'news', 'contact', 'sitemap.xml', 'robots.txt']);

/** 首页区块 key 白名单 */
export const HOME_SECTION_KEYS = ['hero', 'categories', 'services', 'brands', 'store'] as const;

export function isValidHomeSectionKey(key: string): boolean {
  return (HOME_SECTION_KEYS as readonly string[]).includes(key);
}

/** 首页区块条目规范化：入参 [{title_zh,...}] 或 JSON 字符串 */
export function normalizeHomeItems(input: unknown): { title_zh: string; title_en: string; subtitle_zh: string; subtitle_en: string; image: string; url: string }[] {
  let arr: unknown = input;
  if (typeof input === 'string') {
    try {
      arr = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: { title_zh: string; title_en: string; subtitle_zh: string; subtitle_en: string; image: string; url: string }[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    out.push({
      title_zh: str(o.title_zh, 200),
      title_en: str(o.title_en, 200),
      subtitle_zh: str(o.subtitle_zh, 300),
      subtitle_en: str(o.subtitle_en, 300),
      image: str(o.image, 500),
      url: str(o.url, 500),
    });
    if (out.length >= 50) break;
  }
  return out;
}

/** 首页区块校验 */
export function validateHomeSection(body: Record<string, unknown>): ValidationOutcome<HomeSectionInput> {
  const errors: FieldErrors = {};
  let configStr = '{}';
  if (typeof body.config === 'string') {
    try {
      JSON.parse(body.config);
      configStr = body.config.length > 100000 ? '{}' : body.config;
    } catch {
      errors.config = '配置项须为合法 JSON';
    }
  } else if (typeof body.config === 'object' && body.config !== null) {
    configStr = JSON.stringify(body.config).length > 100000 ? '{}' : JSON.stringify(body.config);
  }
  const value: HomeSectionInput = {
    title_zh: str(body.title_zh, 200),
    title_en: str(body.title_en, 200),
    eyebrow_zh: str(body.eyebrow_zh, 200),
    eyebrow_en: str(body.eyebrow_en, 200),
    items: JSON.stringify(normalizeHomeItems(body.items)),
    content_zh: rawStr(body.content_zh, 100000),
    content_en: rawStr(body.content_en, 100000),
    image: str(body.image, 500),
    config: configStr,
    sort_order: int(body.sort_order, 0),
    is_active: int(body.is_active, 1) === 0 ? 0 : 1,
  };
  return { errors, value };
}

/** 找回密码请求校验 */
export function validateForgotPassword(body: Record<string, unknown>): ValidationOutcome<{
  username: string;
  email: string;
}> {
  const errors: FieldErrors = {};
  const value = {
    username: str(body.username, 100),
    email: str(body.email, 200),
  };
  if (!value.username) errors.username = '用户名必填';
  if (!value.email) errors.email = '邮箱必填';
  else if (!EMAIL_RE.test(value.email)) errors.email = '邮箱格式不正确';
  return { errors, value };
}

/** 重置密码校验 */
export function validateResetPassword(body: Record<string, unknown>): ValidationOutcome<{
  token: string;
  new_password: string;
  confirm_password: string;
}> {
  const errors: FieldErrors = {};
  const value = {
    token: str(body.token, 200),
    new_password: typeof body.new_password === 'string' ? body.new_password : '',
    confirm_password: typeof body.confirm_password === 'string' ? body.confirm_password : '',
  };
  if (!value.token) errors.token = '重置令牌缺失';
  if (!value.new_password) errors.new_password = '请输入新密码';
  else if (value.new_password.length < 8) errors.new_password = '新密码至少 8 位';
  if (!value.confirm_password) errors.confirm_password = '请再次输入新密码';
  else if (value.new_password && value.confirm_password !== value.new_password) {
    errors.confirm_password = '两次输入的新密码不一致';
  }
  return { errors, value };
}

/** 修改密码校验（双重确认：旧密码 + 两次输入一致的新密码） */
export function validateChangePassword(body: Record<string, unknown>): ValidationOutcome<{
  old_password: string;
  new_password: string;
  confirm_password: string;
}> {
  const errors: FieldErrors = {};
  const value = {
    old_password: typeof body.old_password === 'string' ? body.old_password : '',
    new_password: typeof body.new_password === 'string' ? body.new_password : '',
    confirm_password: typeof body.confirm_password === 'string' ? body.confirm_password : '',
  };
  if (!value.old_password) errors.old_password = '请输入当前密码';
  if (!value.new_password) errors.new_password = '请输入新密码';
  else if (value.new_password.length < 8) errors.new_password = '新密码至少 8 位';
  if (!value.confirm_password) errors.confirm_password = '请再次输入新密码';
  else if (value.new_password && value.confirm_password !== value.new_password) {
    errors.confirm_password = '两次输入的新密码不一致';
  }
  return { errors, value };
}

/** 站点设置校验（仅允许白名单 key，值为字符串） */
export const SETTING_KEYS = [
  // 基础品牌
  'site_name', 'site_name_zh', 'site_slogan_zh', 'site_slogan_en',
  'logo_image', 'logo_image_zh', 'favicon',
  'primary_color', 'accent_color',
  'footer_text_zh', 'footer_text_en',
  // 联系信息
  'contact_email', 'contact_phone', 'contact_address_zh', 'contact_address_en',
  'contact_wechat', 'contact_whatsapp', 'contact_working_hours_zh', 'contact_working_hours_en',
  // 海外与自定义联系方式
  'contact_overseas_phone',
  'contact_custom_1_label_zh', 'contact_custom_1_label_en', 'contact_custom_1_value',
  'contact_custom_2_label_zh', 'contact_custom_2_label_en', 'contact_custom_2_value',
  // 社交账号
  'social_facebook', 'social_instagram', 'social_linkedin', 'social_twitter', 'social_youtube',
  // SEO 默认
  'seo_default_title_zh', 'seo_default_title_en',
  'seo_default_description_zh', 'seo_default_description_en',
  // 第三方代码
  'head_code',
  // 开发者信息
  'dev_name', 'dev_url', 'dev_tel', 'dev_mail', 'dev_wechat', 'dev_wechat_qr',
  // 询盘 / 邮件
  'inquiry_recipient', 'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
  'smtp_from', 'smtp_from_name', 'smtp_notify_enabled',
  // 其他
  'home_sections', 'icp_number', 'icp_enabled', 'partners_logos',
  'hero_brand_en', 'hero_brand_zh', 'hero_cta_zh', 'hero_cta_en', 'hero_cta_link',
] as const;

export function isValidSettingKey(key: string): boolean {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

export function validateSettings(body: Record<string, unknown>): ValidationOutcome<Record<string, string>> {
  const errors: FieldErrors = {};
  const value: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    if (body[key] !== undefined) {
      value[key] = str(body[key], key === 'home_sections' ? 1000 : 500);
    }
  }
  if (Object.keys(value).length === 0) errors._form = '没有可更新的设置项';
  if (value.inquiry_recipient !== undefined && value.inquiry_recipient && !EMAIL_RE.test(value.inquiry_recipient)) {
    errors.inquiry_recipient = '收件邮箱格式不正确';
  }
  if (value.primary_color !== undefined && value.primary_color && !/^#[0-9a-fA-F]{3,8}$/.test(value.primary_color)) {
    errors.primary_color = '主色须为十六进制色值（如 #2c3e35）';
  }
  if (value.accent_color !== undefined && value.accent_color && !/^#[0-9a-fA-F]{3,8}$/.test(value.accent_color)) {
    errors.accent_color = '强调色须为十六进制色值（如 #b8955a）';
  }
  if (value.icp_enabled !== undefined && value.icp_enabled !== '0' && value.icp_enabled !== '1') {
    errors.icp_enabled = '备案开关取值须为 0 或 1';
  }
  if (value.home_sections !== undefined) {
    try {
      const parsed: unknown = JSON.parse(value.home_sections);
      if (!Array.isArray(parsed)) throw new Error('not array');
    } catch {
      errors.home_sections = '首页版块须为 JSON 数组';
    }
  }
  // 联系信息邮箱格式
  if (value.contact_email !== undefined && value.contact_email && !EMAIL_RE.test(value.contact_email)) {
    errors.contact_email = '联系邮箱格式不正确';
  }
  // 社交账号链接格式
  for (const key of ['social_facebook', 'social_instagram', 'social_linkedin', 'social_twitter', 'social_youtube']) {
    const v = value[key];
    if (v !== undefined && v && !/^https?:\/\//.test(v)) {
      errors[key] = '社交链接须为 http(s) 地址';
    }
  }
  // SMTP 端口（若填写）
  if (value.smtp_port !== undefined && value.smtp_port) {
    const port = Number.parseInt(value.smtp_port, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      errors.smtp_port = 'SMTP 端口须为 1-65535 的整数';
    }
  }
  // SMTP 相关开关
  for (const key of ['smtp_enabled', 'smtp_notify_enabled']) {
    if (value[key] !== undefined && value[key] !== '0' && value[key] !== '1') {
      errors[key] = '开关取值须为 0 或 1';
    }
  }
  return { errors, value };
}

/** 管理员账号校验（创建必须带密码；更新可不修改密码） */
export function validateAdminUser(body: Record<string, unknown>): ValidationOutcome<AdminUserInput> {
  const errors: FieldErrors = {};
  const roleRaw = str(body.role, 20);
  const emailRaw = str(body.email, 200);
  const value: AdminUserInput = {
    username: str(body.username, 100),
    password: typeof body.password === 'string' ? body.password : undefined,
    role: roleRaw === 'super_admin' || roleRaw === 'admin' || roleRaw === 'editor' ? roleRaw : 'editor',
    email: emailRaw,
  };
  if (!value.username) errors.username = '用户名必填';
  if (!value.email) errors.email = '邮箱必填';
  else if (!EMAIL_RE.test(value.email)) {
    errors.email = '邮箱格式不正确';
  }
  if (value.password !== undefined && value.password.length < 8) {
    errors.password = '密码至少 8 位';
  }
  return { errors, value };
}
