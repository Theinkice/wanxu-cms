/**
 * 数据访问层（repo）：直接操作 D1 prepared statements，无 ORM
 * 含 7 个 repo（分类/产品/文章/轮播/页面文案/询盘）+ AuthService（会话鉴权）
 * 时间戳统一 ISO 8601 UTC 字符串，应用层生成；UPDATE 必刷 updated_at
 */

import type {
  AdminUser,
  AdminUserInput,
  Article,
  ArticleInput,
  Banner,
  BannerInput,
  Category,
  CategoryInput,
  CmsPage,
  CmsPageInput,
  HomeSection,
  HomeSectionInput,
  Inquiry,
  InquiryInput,
  Media,
  NavItem,
  NavItemInput,
  Page,
  PageContent,
  PageContentInput,
  Product,
  ProductInput,
  SiteSetting,
  Tag,
  TagInput,
} from '../types';
import { hashPassword, verifyPassword } from './password';

const now = (): string => new Date().toISOString();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 分钟

// ---------------------------------------------------------------- Category

export const CategoryRepo = {
  async list(db: D1Database): Promise<Category[]> {
    const rs = await db
      .prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC')
      .all<Category>();
    return rs.results ?? [];
  },

  async findById(db: D1Database, id: number): Promise<Category | null> {
    const row = await db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .bind(id)
      .first<Category>();
    return row ?? null;
  },

  async create(db: D1Database, data: CategoryInput): Promise<number> {
    const t = now();
    const rs = await db
      .prepare(
        'INSERT INTO categories (name_zh, name_en, subtitle_zh, subtitle_en, cover_image, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(data.name_zh, data.name_en, data.subtitle_zh, data.subtitle_en, data.cover_image, data.sort_order, t, t)
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: CategoryInput): Promise<void> {
    await db
      .prepare(
        'UPDATE categories SET name_zh = ?, name_en = ?, subtitle_zh = ?, subtitle_en = ?, cover_image = ?, sort_order = ?, updated_at = ? WHERE id = ?',
      )
      .bind(data.name_zh, data.name_en, data.subtitle_zh, data.subtitle_en, data.cover_image, data.sort_order, now(), id)
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  },

  async hasProducts(db: D1Database, id: number): Promise<boolean> {
    const row = await db
      .prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?')
      .bind(id)
      .first<{ c: number }>();
    return (row?.c ?? 0) > 0;
  },
};

// ----------------------------------------------------------------- Product

export interface ProductAdminQuery {
  page: number;
  pageSize: number;
  categoryId?: number;
  /** 'active' | 'inactive' | undefined（全部） */
  status?: string;
  /** 标题关键字搜索 */
  q?: string;
}

export const ProductRepo = {
  /** 前台：仅上架产品，按 sort_order 升序 */
  async listPublic(
    db: D1Database,
    categoryId: number | null,
    page: number,
    pageSize: number = 12,
  ): Promise<Page<Product>> {
    const conds = ['is_active = 1'];
    const params: unknown[] = [];
    if (categoryId && categoryId > 0) {
      conds.push('category_id = ?');
      params.push(categoryId);
    }
    const where = conds.join(' AND ');
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM products WHERE ${where}`)
      .bind(...params)
      .first<{ c: number }>();
    const rs = await db
      .prepare(
        `SELECT * FROM products WHERE ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
      )
      .bind(...params, pageSize, (page - 1) * pageSize)
      .all<Product>();
    return { items: rs.results ?? [], total: totalRow?.c ?? 0, page, pageSize };
  },

  async listAdmin(db: D1Database, q: ProductAdminQuery): Promise<Page<Product>> {
    const conds: string[] = ['1 = 1'];
    const params: unknown[] = [];
    if (q.categoryId && q.categoryId > 0) {
      conds.push('category_id = ?');
      params.push(q.categoryId);
    }
    if (q.status === 'active') conds.push('is_active = 1');
    else if (q.status === 'inactive') conds.push('is_active = 0');
    if (q.q) {
      conds.push('(name_zh LIKE ? OR name_en LIKE ?)');
      const like = `%${q.q}%`;
      params.push(like, like);
    }
    const where = conds.join(' AND ');
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM products WHERE ${where}`)
      .bind(...params)
      .first<{ c: number }>();
    const rs = await db
      .prepare(
        `SELECT * FROM products WHERE ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
      )
      .bind(...params, q.pageSize, (q.page - 1) * q.pageSize)
      .all<Product>();
    return { items: rs.results ?? [], total: totalRow?.c ?? 0, page: q.page, pageSize: q.pageSize };
  },

  /** 前台详情：仅上架可见 */
  async findPublicById(db: D1Database, id: number): Promise<Product | null> {
    const row = await db
      .prepare('SELECT * FROM products WHERE id = ? AND is_active = 1')
      .bind(id)
      .first<Product>();
    return row ?? null;
  },

  async findById(db: D1Database, id: number): Promise<Product | null> {
    const row = await db
      .prepare('SELECT * FROM products WHERE id = ?')
      .bind(id)
      .first<Product>();
    return row ?? null;
  },

  async create(db: D1Database, data: ProductInput): Promise<number> {
    const t = now();
    const rs = await db
      .prepare(
        `INSERT INTO products
         (category_id, name_zh, name_en, summary_zh, summary_en, description_zh, description_en,
          main_image, images, sizes, sizes_en, colors, colors_en, params_zh, params_en,
          seo_title_zh, seo_title_en, seo_description_zh, seo_description_en,
          sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        data.category_id, data.name_zh, data.name_en, data.summary_zh, data.summary_en,
        data.description_zh, data.description_en, data.main_image, data.images,
        data.sizes, data.sizes_en, data.colors, data.colors_en, data.params_zh, data.params_en,
        data.seo_title_zh, data.seo_title_en, data.seo_description_zh, data.seo_description_en,
        data.sort_order, data.is_active, t, t,
      )
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: ProductInput): Promise<void> {
    await db
      .prepare(
        `UPDATE products SET
         category_id = ?, name_zh = ?, name_en = ?, summary_zh = ?, summary_en = ?,
         description_zh = ?, description_en = ?, main_image = ?, images = ?,
         sizes = ?, sizes_en = ?, colors = ?, colors_en = ?, params_zh = ?, params_en = ?,
         seo_title_zh = ?, seo_title_en = ?, seo_description_zh = ?, seo_description_en = ?,
         sort_order = ?, is_active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        data.category_id, data.name_zh, data.name_en, data.summary_zh, data.summary_en,
        data.description_zh, data.description_en, data.main_image, data.images,
        data.sizes, data.sizes_en, data.colors, data.colors_en, data.params_zh, data.params_en,
        data.seo_title_zh, data.seo_title_en, data.seo_description_zh, data.seo_description_en,
        data.sort_order, data.is_active, now(), id,
      )
      .run();
  },

  async setStatus(db: D1Database, id: number, active: boolean): Promise<void> {
    await db
      .prepare('UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?')
      .bind(active ? 1 : 0, now(), id)
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  },

  /** 首页推荐：上架产品按 sort_order 取前 limit 个 */
  async featured(db: D1Database, limit: number): Promise<Product[]> {
    const rs = await db
      .prepare(
        'SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT ?',
      )
      .bind(limit)
      .all<Product>();
    return rs.results ?? [];
  },
};

// ----------------------------------------------------------------- Article

export interface ArticleAdminQuery {
  page: number;
  pageSize: number;
  /** 'draft' | 'published' | undefined（全部） */
  status?: string;
  /** 标题关键字搜索 */
  q?: string;
}

export const ArticleRepo = {
  /** 前台：仅已发布，按发布时间倒序 */
  async listPublic(db: D1Database, page: number, pageSize: number = 10): Promise<Page<Article>> {
    const totalRow = await db
      .prepare("SELECT COUNT(*) AS c FROM articles WHERE status = 'published'")
      .first<{ c: number }>();
    const rs = await db
      .prepare(
        `SELECT * FROM articles WHERE status = 'published'
         ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .bind(pageSize, (page - 1) * pageSize)
      .all<Article>();
    return { items: rs.results ?? [], total: totalRow?.c ?? 0, page, pageSize };
  },

  async listAdmin(db: D1Database, q: ArticleAdminQuery): Promise<Page<Article>> {
    const conds: string[] = ['1 = 1'];
    const params: unknown[] = [];
    if (q.status === 'draft' || q.status === 'published') {
      conds.push('status = ?');
      params.push(q.status);
    }
    if (q.q) {
      conds.push('(title_zh LIKE ? OR title_en LIKE ?)');
      const like = `%${q.q}%`;
      params.push(like, like);
    }
    const where = conds.join(' AND ');
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM articles WHERE ${where}`)
      .bind(...params)
      .first<{ c: number }>();
    const rs = await db
      .prepare(
        `SELECT * FROM articles WHERE ${where} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, q.pageSize, (q.page - 1) * q.pageSize)
      .all<Article>();
    return { items: rs.results ?? [], total: totalRow?.c ?? 0, page: q.page, pageSize: q.pageSize };
  },

  /** 前台详情：仅已发布可见 */
  async findPublicById(db: D1Database, id: number): Promise<Article | null> {
    const row = await db
      .prepare("SELECT * FROM articles WHERE id = ? AND status = 'published'")
      .bind(id)
      .first<Article>();
    return row ?? null;
  },

  async findById(db: D1Database, id: number): Promise<Article | null> {
    const row = await db
      .prepare('SELECT * FROM articles WHERE id = ?')
      .bind(id)
      .first<Article>();
    return row ?? null;
  },

  async create(db: D1Database, data: ArticleInput): Promise<number> {
    const t = now();
    const publishedAt = data.status === 'published' ? t : null;
    const rs = await db
      .prepare(
        `INSERT INTO articles
         (title_zh, title_en, summary_zh, summary_en, content_zh, content_en,
          cover_image, seo_title_zh, seo_title_en, seo_description_zh, seo_description_en,
          status, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        data.title_zh, data.title_en, data.summary_zh, data.summary_en,
        data.content_zh, data.content_en, data.cover_image,
        data.seo_title_zh, data.seo_title_en, data.seo_description_zh, data.seo_description_en,
        data.status, publishedAt, t, t,
      )
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: ArticleInput): Promise<void> {
    // 首次置 published 时写 published_at；再次编辑不刷新发布时间
    const existing = await ArticleRepo.findById(db, id);
    const publishedAt =
      data.status === 'published'
        ? existing?.published_at ?? now()
        : existing?.published_at ?? null;
    await db
      .prepare(
        `UPDATE articles SET
         title_zh = ?, title_en = ?, summary_zh = ?, summary_en = ?,
         content_zh = ?, content_en = ?, cover_image = ?,
         seo_title_zh = ?, seo_title_en = ?, seo_description_zh = ?, seo_description_en = ?,
         status = ?, published_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        data.title_zh, data.title_en, data.summary_zh, data.summary_en,
        data.content_zh, data.content_en, data.cover_image,
        data.seo_title_zh, data.seo_title_en, data.seo_description_zh, data.seo_description_en,
        data.status, publishedAt, now(), id,
      )
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
  },
};

// ------------------------------------------------------------------ Banner

export const BannerRepo = {
  async list(db: D1Database): Promise<Banner[]> {
    const rs = await db
      .prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC')
      .all<Banner>();
    return rs.results ?? [];
  },

  async findById(db: D1Database, id: number): Promise<Banner | null> {
    const row = await db
      .prepare('SELECT * FROM banners WHERE id = ?')
      .bind(id)
      .first<Banner>();
    return row ?? null;
  },

  async create(db: D1Database, data: BannerInput): Promise<number> {
    const rs = await db
      .prepare(
        `INSERT INTO banners (image, title_zh, title_en, subtitle_zh, subtitle_en, link, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(data.image, data.title_zh, data.title_en, data.subtitle_zh, data.subtitle_en, data.link, data.sort_order)
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: BannerInput): Promise<void> {
    await db
      .prepare(
        `UPDATE banners SET image = ?, title_zh = ?, title_en = ?, subtitle_zh = ?, subtitle_en = ?, link = ?, sort_order = ?
         WHERE id = ?`,
      )
      .bind(data.image, data.title_zh, data.title_en, data.subtitle_zh, data.subtitle_en, data.link, data.sort_order, id)
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();
  },
};

// ------------------------------------------------------------- PageContent

export const PageContentRepo = {
  async list(db: D1Database): Promise<PageContent[]> {
    const rs = await db.prepare('SELECT * FROM page_contents ORDER BY key ASC').all<PageContent>();
    return rs.results ?? [];
  },

  async get(db: D1Database, key: string): Promise<PageContent | null> {
    const row = await db
      .prepare('SELECT * FROM page_contents WHERE key = ?')
      .bind(key)
      .first<PageContent>();
    return row ?? null;
  },

  async upsert(db: D1Database, key: string, data: PageContentInput): Promise<void> {
    await db
      .prepare(
        `INSERT INTO page_contents (key, content_zh, content_en, image, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           content_zh = excluded.content_zh,
           content_en = excluded.content_en,
           image = excluded.image,
           updated_at = excluded.updated_at`,
      )
      .bind(key, data.content_zh, data.content_en, data.image, now())
      .run();
  },
};

// ----------------------------------------------------------------- Inquiry

export interface InquiryAdminQuery {
  page: number;
  pageSize: number;
  /** '0' | '1' | undefined（全部） */
  read?: string;
}

export const InquiryRepo = {
  async create(db: D1Database, data: InquiryInput, source: 'site' | 'email' = 'site'): Promise<number> {
    const rs = await db
      .prepare(
        `INSERT INTO inquiries (name, email, company, country, message, product_ref, source, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(data.name, data.email, data.company, data.country, data.message, data.product_ref, source, now())
      .run();
    return Number(rs.meta.last_row_id);
  },

  async markMailSent(db: D1Database, id: number, sent: boolean): Promise<void> {
    await db
      .prepare('UPDATE inquiries SET mail_sent = ? WHERE id = ?')
      .bind(sent ? 1 : 0, id)
      .run();
  },

  async list(db: D1Database, q: InquiryAdminQuery): Promise<Page<Inquiry>> {
    const conds: string[] = ['1 = 1'];
    const params: unknown[] = [];
    if (q.read === '0' || q.read === '1') {
      conds.push('is_read = ?');
      params.push(Number(q.read));
    }
    const where = conds.join(' AND ');
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM inquiries WHERE ${where}`)
      .bind(...params)
      .first<{ c: number }>();
    const rs = await db
      .prepare(
        `SELECT * FROM inquiries WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, q.pageSize, (q.page - 1) * q.pageSize)
      .all<Inquiry>();
    return { items: rs.results ?? [], total: totalRow?.c ?? 0, page: q.page, pageSize: q.pageSize };
  },

  async findById(db: D1Database, id: number): Promise<Inquiry | null> {
    const row = await db
      .prepare('SELECT * FROM inquiries WHERE id = ?')
      .bind(id)
      .first<Inquiry>();
    return row ?? null;
  },

  async markRead(db: D1Database, id: number, read: boolean): Promise<void> {
    await db
      .prepare('UPDATE inquiries SET is_read = ? WHERE id = ?')
      .bind(read ? 1 : 0, id)
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM inquiries WHERE id = ?').bind(id).run();
  },

  async unreadCount(db: D1Database): Promise<number> {
    const row = await db
      .prepare('SELECT COUNT(*) AS c FROM inquiries WHERE is_read = 0')
      .first<{ c: number }>();
    return row?.c ?? 0;
  },
};

// ------------------------------------------------------------------- Auth

export const AuthService = {
  /** 校验用户名密码，成功则创建会话并返回 token 与管理员 */
  async login(
    db: D1Database,
    username: string,
    password: string,
  ): Promise<{ token: string; admin: AdminUser } | null> {
    const admin = await db
      .prepare('SELECT * FROM admin_users WHERE username = ?')
      .bind(username)
      .first<AdminUser>();
    if (!admin) return null;
    const okPwd = await verifyPassword(password, admin.password_hash);
    if (!okPwd) return null;
    // 32 字节随机 hex 令牌
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const t = now();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await db
      .prepare('INSERT INTO sessions (token, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(token, admin.id, expiresAt, t)
      .run();
    return { token, admin };
  },

  async logout(db: D1Database, token: string): Promise<void> {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  },

  /** 修改密码：校验旧密码后更新为新密码 */
  async changePassword(
    db: D1Database,
    adminId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const admin = await db
      .prepare('SELECT id, password_hash FROM admin_users WHERE id = ?')
      .bind(adminId)
      .first<{ id: number; password_hash: string }>();
    if (!admin) return { ok: false, reason: '账号不存在' };
    const valid = await verifyPassword(oldPassword, admin.password_hash);
    if (!valid) return { ok: false, reason: '当前密码不正确' };
    const newHash = await hashPassword(newPassword);
    await db
      .prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')
      .bind(newHash, adminId)
      .run();
    // 改密后吊销该账号全部已有会话，强制重新登录
    await db.prepare('DELETE FROM sessions WHERE admin_id = ?').bind(adminId).run();
    return { ok: true };
  },

  /** 校验会话令牌，有效则返回管理员（同时惰性清理过期会话） */
  async resolveSession(db: D1Database, token: string): Promise<AdminUser | null> {
    const admin = await db
      .prepare(
        `SELECT u.id, u.username, u.password_hash, u.role, u.email, u.created_at
         FROM sessions s JOIN admin_users u ON u.id = s.admin_id
         WHERE s.token = ? AND s.expires_at > ?`,
      )
      .bind(token, now())
      .first<AdminUser>();
    if (!admin) return null;
    return admin;
  },

  /** 生成密码重置令牌（30 分钟有效） */
  async createPasswordResetToken(
    db: D1Database,
    adminId: number,
  ): Promise<string> {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    await PasswordResetRepo.invalidateForAdmin(db, adminId);
    await PasswordResetRepo.create(db, adminId, token);
    return token;
  },

  /** 校验重置令牌：存在、未过期、未使用 */
  async verifyPasswordResetToken(
    db: D1Database,
    token: string,
  ): Promise<{ ok: boolean; admin?: AdminUser; reason?: string }> {
    const row = await PasswordResetRepo.findByToken(db, token);
    if (!row) return { ok: false, reason: '令牌无效或已过期' };
    if (row.used) return { ok: false, reason: '令牌已使用' };
    if (row.expires_at < now()) return { ok: false, reason: '令牌已过期' };
    const admin = await AdminUserRepo.findById(db, row.admin_id);
    if (!admin) return { ok: false, reason: '关联管理员不存在' };
    return { ok: true, admin };
  },

  /** 使用令牌重置密码 */
  async resetPassword(
    db: D1Database,
    token: string,
    newPassword: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const check = await this.verifyPasswordResetToken(db, token);
    if (!check.ok) return { ok: false, reason: check.reason };
    const passwordHash = await hashPassword(newPassword);
    await AdminUserRepo.updatePassword(db, check.admin!.id, passwordHash);
    await PasswordResetRepo.markUsed(db, token);
    // 安全：重置后吊销该账号的全部登录会话，避免旧会话（可能已泄露）继续可用
    await db.prepare('DELETE FROM sessions WHERE admin_id = ?').bind(check.admin!.id).run();
    return { ok: true };
  },
};

// ------------------------------------------------------------ PasswordResetRepo

export interface PasswordResetRecord {
  token: string;
  admin_id: number;
  expires_at: string;
  used: number;
  created_at: string;
}

export const PasswordResetRepo = {
  async create(db: D1Database, adminId: number, token: string): Promise<void> {
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
    await db
      .prepare(
        'INSERT INTO password_resets (token, admin_id, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)',
      )
      .bind(token, adminId, expiresAt, now())
      .run();
  },

  async findByToken(db: D1Database, token: string): Promise<PasswordResetRecord | null> {
    const row = await db
      .prepare('SELECT * FROM password_resets WHERE token = ?')
      .bind(token)
      .first<PasswordResetRecord>();
    return row ?? null;
  },

  async markUsed(db: D1Database, token: string): Promise<void> {
    await db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').bind(token).run();
  },

  async invalidateForAdmin(db: D1Database, adminId: number): Promise<void> {
    await db.prepare('UPDATE password_resets SET used = 1 WHERE admin_id = ?').bind(adminId).run();
  },
};

// ------------------------------------------------------------ AdminUserRepo

export const AdminUserRepo = {
  async list(db: D1Database): Promise<AdminUser[]> {
    const rs = await db
      .prepare('SELECT id, username, role, email, created_at FROM admin_users ORDER BY id ASC')
      .all<AdminUser>();
    return rs.results ?? [];
  },

  async findById(db: D1Database, id: number): Promise<AdminUser | null> {
    const row = await db
      .prepare('SELECT id, username, role, email, created_at FROM admin_users WHERE id = ?')
      .bind(id)
      .first<AdminUser>();
    return row ?? null;
  },

  async findByUsernameAndEmail(
    db: D1Database,
    username: string,
    email: string,
  ): Promise<AdminUser | null> {
    const row = await db
      .prepare('SELECT * FROM admin_users WHERE username = ? AND email = ?')
      .bind(username, email)
      .first<AdminUser>();
    return row ?? null;
  },

  async findByEmail(db: D1Database, email: string, excludeId?: number): Promise<AdminUser | null> {
    const sql = excludeId
      ? 'SELECT id FROM admin_users WHERE email = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM admin_users WHERE email = ? LIMIT 1';
    const stmt = db.prepare(sql).bind(email, ...(excludeId !== undefined ? [excludeId] : []));
    const row = await stmt.first<{ id: number }>();
    return row ? ({ id: row.id } as AdminUser) : null;
  },

  async findByUsername(db: D1Database, username: string, excludeId?: number): Promise<AdminUser | null> {
    const sql = excludeId
      ? 'SELECT id FROM admin_users WHERE username = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM admin_users WHERE username = ? LIMIT 1';
    const stmt = db.prepare(sql).bind(username, ...(excludeId !== undefined ? [excludeId] : []));
    const row = await stmt.first<{ id: number }>();
    return row ? ({ id: row.id } as AdminUser) : null;
  },

  async create(db: D1Database, data: AdminUserInput): Promise<number> {
    const passwordHash = await hashPassword(data.password ?? '');
    const rs = await db
      .prepare(
        'INSERT INTO admin_users (username, password_hash, role, email, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(data.username, passwordHash, data.role, data.email ?? '', now())
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: AdminUserInput): Promise<void> {
    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      await db
        .prepare(
          'UPDATE admin_users SET username = ?, role = ?, email = ?, password_hash = ? WHERE id = ?',
        )
        .bind(data.username, data.role, data.email ?? '', passwordHash, id)
        .run();
    } else {
      await db
        .prepare('UPDATE admin_users SET username = ?, role = ?, email = ? WHERE id = ?')
        .bind(data.username, data.role, data.email ?? '', id)
        .run();
    }
  },

  async updatePassword(db: D1Database, id: number, passwordHash: string): Promise<void> {
    await db
      .prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')
      .bind(passwordHash, id)
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();
  },

  async countSuperAdmins(db: D1Database): Promise<number> {
    const row = await db
      .prepare("SELECT COUNT(*) AS c FROM admin_users WHERE role = 'super_admin'")
      .first<{ c: number }>();
    return row?.c ?? 0;
  },
};

// ------------------------------------------------------------------ NavRepo

export const NavRepo = {
  /** 前台：仅启用项 */
  async listPublic(db: D1Database): Promise<NavItem[]> {
    const rs = await db
      .prepare('SELECT * FROM nav_items WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
      .all<NavItem>();
    return rs.results ?? [];
  },

  async listAdmin(db: D1Database): Promise<NavItem[]> {
    const rs = await db
      .prepare('SELECT * FROM nav_items ORDER BY sort_order ASC, id ASC')
      .all<NavItem>();
    return rs.results ?? [];
  },

  async findById(db: D1Database, id: number): Promise<NavItem | null> {
    const row = await db
      .prepare('SELECT * FROM nav_items WHERE id = ?')
      .bind(id)
      .first<NavItem>();
    return row ?? null;
  },

  async create(db: D1Database, data: NavItemInput): Promise<number> {
    const rs = await db
      .prepare(
        'INSERT INTO nav_items (parent_id, label_zh, label_en, url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(data.parent_id, data.label_zh, data.label_en, data.url, data.sort_order, data.is_active)
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: NavItemInput): Promise<void> {
    await db
      .prepare(
        'UPDATE nav_items SET parent_id = ?, label_zh = ?, label_en = ?, url = ?, sort_order = ?, is_active = ? WHERE id = ?',
      )
      .bind(data.parent_id, data.label_zh, data.label_en, data.url, data.sort_order, data.is_active, id)
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM nav_items WHERE id = ?').bind(id).run();
  },
};

// ------------------------------------------------------------------ PagesRepo

export interface PagesAdminQuery {
  page: number;
  pageSize: number;
  /** 标题/URL 关键字搜索 */
  q?: string;
}

export const PagesRepo = {
  /** 前台：仅上架页面，按 sort_order 升序 */
  async listPublic(db: D1Database): Promise<CmsPage[]> {
    const rs = await db
      .prepare('SELECT * FROM pages WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
      .all<CmsPage>();
    return rs.results ?? [];
  },

  async listAdmin(db: D1Database): Promise<CmsPage[]> {
    const rs = await db
      .prepare('SELECT * FROM pages ORDER BY sort_order ASC, id ASC')
      .all<CmsPage>();
    return rs.results ?? [];
  },

  async listAdminPaged(db: D1Database, q: PagesAdminQuery): Promise<Page<CmsPage>> {
    const conds: string[] = ['1 = 1'];
    const params: unknown[] = [];
    if (q.q) {
      conds.push('(title_zh LIKE ? OR title_en LIKE ? OR slug LIKE ?)');
      const like = `%${q.q}%`;
      params.push(like, like, like);
    }
    const where = conds.join(' AND ');
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM pages WHERE ${where}`)
      .bind(...params)
      .first<{ c: number }>();
    const rs = await db
      .prepare(`SELECT * FROM pages WHERE ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`)
      .bind(...params, q.pageSize, (q.page - 1) * q.pageSize)
      .all<CmsPage>();
    return { items: rs.results ?? [], total: totalRow?.c ?? 0, page: q.page, pageSize: q.pageSize };
  },

  async findPublicBySlug(db: D1Database, slug: string): Promise<CmsPage | null> {
    const row = await db
      .prepare('SELECT * FROM pages WHERE slug = ? AND is_active = 1')
      .bind(slug)
      .first<CmsPage>();
    return row ?? null;
  },

  async findById(db: D1Database, id: number): Promise<CmsPage | null> {
    const row = await db
      .prepare('SELECT * FROM pages WHERE id = ?')
      .bind(id)
      .first<CmsPage>();
    return row ?? null;
  },

  async findBySlug(db: D1Database, slug: string): Promise<CmsPage | null> {
    const row = await db
      .prepare('SELECT * FROM pages WHERE slug = ?')
      .bind(slug)
      .first<CmsPage>();
    return row ?? null;
  },

  async create(db: D1Database, data: CmsPageInput): Promise<number> {
    const t = now();
    const rs = await db
      .prepare(
        `INSERT INTO pages
         (slug, title_zh, title_en, content_zh, content_en, cover_image,
          seo_title_zh, seo_title_en, seo_description_zh, seo_description_en,
          is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        data.slug, data.title_zh, data.title_en, data.content_zh, data.content_en, data.cover_image,
        data.seo_title_zh, data.seo_title_en, data.seo_description_zh, data.seo_description_en,
        data.is_active, data.sort_order, t, t,
      )
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: CmsPageInput): Promise<void> {
    await db
      .prepare(
        `UPDATE pages SET
         slug = ?, title_zh = ?, title_en = ?, content_zh = ?, content_en = ?,
         cover_image = ?, seo_title_zh = ?, seo_title_en = ?, seo_description_zh = ?, seo_description_en = ?,
         is_active = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        data.slug, data.title_zh, data.title_en, data.content_zh, data.content_en, data.cover_image,
        data.seo_title_zh, data.seo_title_en, data.seo_description_zh, data.seo_description_en,
        data.is_active, data.sort_order, now(), id,
      )
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
  },
};

// ------------------------------------------------------------ SearchRepo

export interface SearchResultItem {
  type: 'product' | 'article' | 'page';
  id: number;
  title: string;
  summary: string;
  url: string;
  image: string;
}

export const SearchRepo = {
  async search(db: D1Database, lang: 'zh' | 'en', q: string): Promise<SearchResultItem[]> {
    const keyword = q.trim();
    if (!keyword) return [];
    const like = `%${keyword}%`;
    const nameCol = lang === 'zh' ? 'name_zh' : 'name_en';
    const summaryCol = lang === 'zh' ? 'summary_zh' : 'summary_en';
    const titleCol = lang === 'zh' ? 'title_zh' : 'title_en';
    const contentCol = lang === 'zh' ? 'content_zh' : 'content_en';
    const paramsCol = lang === 'zh' ? 'params_zh' : 'params_en';

    const [products, articles, pages] = await Promise.all([
      db
        .prepare(
          `SELECT id, ${nameCol} AS title, ${summaryCol} AS summary, main_image AS image
           FROM products
           WHERE is_active = 1
             AND (name_zh LIKE ? OR name_en LIKE ? OR summary_zh LIKE ? OR summary_en LIKE ? OR params_zh LIKE ? OR params_en LIKE ?)
           ORDER BY sort_order ASC, id ASC LIMIT 6`,
        )
        .bind(like, like, like, like, like, like)
        .all<{ id: number; title: string; summary: string; image: string }>(),
      db
        .prepare(
          `SELECT id, ${titleCol} AS title, ${summaryCol} AS summary, cover_image AS image
           FROM articles
           WHERE status = 'published'
             AND (title_zh LIKE ? OR title_en LIKE ? OR summary_zh LIKE ? OR summary_en LIKE ? OR content_zh LIKE ? OR content_en LIKE ?)
           ORDER BY published_at DESC, id DESC LIMIT 6`,
        )
        .bind(like, like, like, like, like, like)
        .all<{ id: number; title: string; summary: string; image: string }>(),
      db
        .prepare(
          `SELECT id, slug, ${titleCol} AS title, ${contentCol} AS content
           FROM pages
           WHERE is_active = 1
             AND (title_zh LIKE ? OR title_en LIKE ? OR content_zh LIKE ? OR content_en LIKE ? OR slug LIKE ?)
           ORDER BY sort_order ASC, id ASC LIMIT 6`,
        )
        .bind(like, like, like, like, like)
        .all<{ id: number; slug: string; title: string; content: string }>(),
    ]);

    const stripHtml = (html: string): string =>
      (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const excerpt = (text: string, max = 110): string => {
      const t = stripHtml(text);
      return t.length > max ? t.slice(0, max) + '…' : t;
    };

    const results: SearchResultItem[] = [];
    for (const row of products.results ?? []) {
      results.push({
        type: 'product',
        id: row.id,
        title: row.title || '',
        summary: excerpt(row.summary),
        url: `/${lang}/products/${row.id}`,
        image: row.image || '',
      });
    }
    for (const row of articles.results ?? []) {
      results.push({
        type: 'article',
        id: row.id,
        title: row.title || '',
        summary: excerpt(row.summary),
        url: `/${lang}/news/${row.id}`,
        image: row.image || '',
      });
    }
    for (const row of pages.results ?? []) {
      results.push({
        type: 'page',
        id: row.id,
        title: row.title || '',
        summary: excerpt(row.content),
        url: `/${lang}/${row.slug}`,
        image: '',
      });
    }
    return results;
  },
};

// ------------------------------------------------------------ HomeSectionRepo

export const HomeSectionRepo = {
  /** 前台：仅启用，按 sort_order 升序 */
  async listPublic(db: D1Database): Promise<HomeSection[]> {
    const rs = await db
      .prepare('SELECT * FROM home_sections WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
      .all<HomeSection>();
    return rs.results ?? [];
  },

  async listAdmin(db: D1Database): Promise<HomeSection[]> {
    const rs = await db
      .prepare('SELECT * FROM home_sections ORDER BY sort_order ASC, id ASC')
      .all<HomeSection>();
    return rs.results ?? [];
  },

  async findByKey(db: D1Database, key: string): Promise<HomeSection | null> {
    const row = await db
      .prepare('SELECT * FROM home_sections WHERE key = ?')
      .bind(key)
      .first<HomeSection>();
    return row ?? null;
  },

  async update(db: D1Database, key: string, data: HomeSectionInput): Promise<void> {
    await db
      .prepare(
        `UPDATE home_sections SET
         title_zh = ?, title_en = ?, eyebrow_zh = ?, eyebrow_en = ?, items = ?,
         content_zh = ?, content_en = ?, image = ?, config = ?, sort_order = ?, is_active = ?
         WHERE key = ?`,
      )
      .bind(
        data.title_zh, data.title_en, data.eyebrow_zh, data.eyebrow_en, data.items,
        data.content_zh, data.content_en, data.image, data.config, data.sort_order, data.is_active, key,
      )
      .run();
  },
};

// --------------------------------------------------------------------- Tags

export const TagRepo = {
  async list(db: D1Database): Promise<Tag[]> {
    const rs = await db
      .prepare('SELECT * FROM tags ORDER BY sort_order ASC, id ASC')
      .all<Tag>();
    return rs.results ?? [];
  },

  async findById(db: D1Database, id: number): Promise<Tag | null> {
    const row = await db.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first<Tag>();
    return row ?? null;
  },

  async findBySlug(db: D1Database, slug: string): Promise<Tag | null> {
    const row = await db.prepare('SELECT * FROM tags WHERE slug = ?').bind(slug).first<Tag>();
    return row ?? null;
  },

  async create(db: D1Database, data: TagInput): Promise<number> {
    const t = now();
    const rs = await db
      .prepare(
        'INSERT INTO tags (name_zh, name_en, slug, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(data.name_zh, data.name_en, data.slug, data.sort_order, t, t)
      .run();
    return Number(rs.meta.last_row_id);
  },

  async update(db: D1Database, id: number, data: TagInput): Promise<void> {
    await db
      .prepare(
        'UPDATE tags SET name_zh = ?, name_en = ?, slug = ?, sort_order = ?, updated_at = ? WHERE id = ?',
      )
      .bind(data.name_zh, data.name_en, data.slug, data.sort_order, now(), id)
      .run();
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
  },

  /** 获取内容关联的标签 id 数组 */
  async getTagIdsFor(db: D1Database, table: 'product_tags' | 'article_tags' | 'page_tags', targetId: number): Promise<number[]> {
    const col = table === 'product_tags' ? 'product_id' : table === 'article_tags' ? 'article_id' : 'page_id';
    const rs = await db
      .prepare(`SELECT tag_id FROM ${table} WHERE ${col} = ?`)
      .bind(targetId)
      .all<{ tag_id: number }>();
    return (rs.results ?? []).map((r) => r.tag_id);
  },

  /** 替换内容关联的标签 */
  async setTagsFor(db: D1Database, table: 'product_tags' | 'article_tags' | 'page_tags', targetId: number, tagIds: number[]): Promise<void> {
    const col = table === 'product_tags' ? 'product_id' : table === 'article_tags' ? 'article_id' : 'page_id';
    await db.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).bind(targetId).run();
    if (tagIds.length === 0) return;
    const stmt = db.prepare(`INSERT INTO ${table} (${col}, tag_id) VALUES (?, ?)`);
    for (const tagId of tagIds) {
      await stmt.bind(targetId, tagId).run();
    }
  },
};

// ------------------------------------------------------------------- Media

export const MediaRepo = {
  async list(db: D1Database, page = 1, pageSize = 40, q?: string, type?: string): Promise<Page<Media>> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (q) {
      conds.push('(filename LIKE ? OR url LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    const typeFilter = (type || 'all').toLowerCase();
    if (typeFilter !== 'all') {
      if (typeFilter === 'image') {
        conds.push("mime_type LIKE 'image/%'");
      } else if (typeFilter === 'document') {
        conds.push(
          "(mime_type IN ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/markdown','text/csv','application/json') OR mime_type LIKE 'text/%')",
        );
      } else if (typeFilter === 'archive') {
        conds.push(
          "mime_type IN ('application/zip','application/x-zip-compressed','application/x-rar-compressed','application/x-7z-compressed')",
        );
      } else if (typeFilter === 'video') {
        conds.push("mime_type LIKE 'video/%'");
      } else if (typeFilter === 'audio') {
        conds.push("mime_type LIKE 'audio/%'");
      } else if (typeFilter === 'media') {
        conds.push("(mime_type LIKE 'audio/%' OR mime_type LIKE 'video/%')");
      } else {
        conds.push('mime_type LIKE ?');
        params.push(`${typeFilter}/%`);
      }
    }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const totalRow = await db.prepare(`SELECT COUNT(*) AS c FROM media ${where}`).bind(...params).first<{ c: number }>();
    const rs = await db
      .prepare(`SELECT * FROM media ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, (page - 1) * pageSize)
      .all<Media>();
    return { items: rs.results ?? [], total: totalRow?.c ?? 0, page, pageSize };
  },

  async create(db: D1Database, data: Omit<Media, 'id' | 'created_at'>): Promise<number> {
    const rs = await db
      .prepare('INSERT INTO media (url, filename, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(data.url, data.filename, data.mime_type, data.size, now())
      .run();
    return Number(rs.meta.last_row_id);
  },

  async findById(db: D1Database, id: number): Promise<Media | null> {
    const row = await db.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<Media>();
    return row ?? null;
  },

  async delete(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
  },
};

// ------------------------------------------------------------- SettingsRepo

export const SettingsRepo = {
  async list(db: D1Database): Promise<SiteSetting[]> {
    const rs = await db.prepare('SELECT * FROM site_settings ORDER BY key ASC').all<SiteSetting>();
    return rs.results ?? [];
  },

  /** 读取单个设置，缺省返回 fallback */
  async get(db: D1Database, key: string, fallback = ''): Promise<string> {
    const row = await db
      .prepare('SELECT value FROM site_settings WHERE key = ?')
      .bind(key)
      .first<{ value: string }>();
    return row?.value ?? fallback;
  },

  /** 读取全部设置为键值对象（前台布局使用） */
  async getAll(db: D1Database): Promise<Record<string, string>> {
    const rows = await SettingsRepo.list(db);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  },

  async set(db: D1Database, key: string, value: string): Promise<void> {
    await db
      .prepare(
        `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(key, value, now())
      .run();
  },

  async setMany(db: D1Database, entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await SettingsRepo.set(db, key, value);
    }
  },
};
