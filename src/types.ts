/**
 * 晚叙 CMS 全局类型定义
 * - Bindings: wrangler.toml 中的绑定与变量
 * - AppVariables: 中间件注入到 Hono context 的变量
 * - 数据模型与 D1 表结构一一对应（见 db/schema.sql）
 */

export type Lang = 'en' | 'zh';

/** 管理员角色：super_admin > admin > editor */
export type AdminRole = 'super_admin' | 'admin' | 'editor';

export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  SITE_URL: string;
  /** 后台访问入口路径，默认 /admin；可在 wrangler.toml [vars] 中配置 */
  ADMIN_PATH: string;
  /** 是否开启根据 IP 国家自动跳转首页语言：'true'（默认）| 'false' */
  GEO_REDIRECT?: string;
  /** 是否关闭 D1 速率限制（仅本地测试用，生产环境请勿设置） */
  RATE_LIMIT_DISABLED?: string;
  /** 开发者验证签名密钥（线上请通过 wrangler secret put 设置，勿硬编码） */
  DEV_CHALLENGE_SECRET?: string;
  /** 开发者验证问题与答案（未配置则使用默认） */
  DEV_CHALLENGE_QUESTION?: string;
  DEV_CHALLENGE_ANSWER?: string;
  /** 询盘邮件通知（可选，见 docs/DEPLOY.md）。二选一配置：
   *  EMAIL_API_URL + EMAIL_API_TOKEN → 通用 JSON Webhook / Resend 等
   *  MAILGUN_* 等不内置，统一走 EMAIL_API_URL 转发 */
  EMAIL_API_URL?: string;
  EMAIL_API_TOKEN?: string;
  EMAIL_FROM?: string;
}

export interface AppVariables {
  lang: Lang;
  admin: AdminUser;
}

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  role: AdminRole;
  email: string;
  created_at: string;
}

export interface Session {
  token: string;
  admin_id: number;
  expires_at: string;
  created_at: string;
}

export interface Category {
  id: number;
  name_zh: string;
  name_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  cover_image: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  name_zh: string;
  name_en: string;
  summary_zh: string;
  summary_en: string;
  description_zh: string;
  description_en: string;
  main_image: string;
  /** JSON 字符串数组（图集），读写时 JSON.parse/stringify */
  images: string;
  sizes: string;
  sizes_en: string;
  colors: string;
  colors_en: string;
  /** JSON [{key,value}] 外贸展示参数 */
  params_zh: string;
  params_en: string;
  seo_title_zh: string;
  seo_title_en: string;
  seo_description_zh: string;
  seo_description_en: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: number;
  title_zh: string;
  title_en: string;
  summary_zh: string;
  summary_en: string;
  content_zh: string;
  content_en: string;
  cover_image: string;
  seo_title_zh: string;
  seo_title_en: string;
  seo_description_zh: string;
  seo_description_en: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: number;
  image: string;
  title_zh: string;
  title_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  link: string;
  sort_order: number;
}

export interface PageContent {
  key: string;
  content_zh: string;
  content_en: string;
  image: string;
  updated_at: string;
}

export interface Inquiry {
  id: number;
  name: string;
  email: string;
  company: string;
  country: string;
  message: string;
  product_ref: string;
  /** 'site'=站内表单；'email'=邮件渠道转入 */
  source: 'site' | 'email';
  mail_sent: number;
  is_read: number;
  created_at: string;
}

/** 导航项（parent_id=0 为一级导航，>0 为挂在某一级下的二级导航） */
export interface NavItem {
  id: number;
  parent_id: number;
  label_zh: string;
  label_en: string;
  url: string;
  sort_order: number;
  is_active: number;
}

export interface NavItemInput {
  parent_id: number;
  label_zh: string;
  label_en: string;
  url: string;
  sort_order: number;
  is_active: number;
}

/** 自定义页面（后台"页面管理"） */
export interface CmsPage {
  id: number;
  slug: string;
  title_zh: string;
  title_en: string;
  content_zh: string;
  content_en: string;
  cover_image: string;
  seo_title_zh: string;
  seo_title_en: string;
  seo_description_zh: string;
  seo_description_en: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CmsPageInput {
  slug: string;
  title_zh: string;
  title_en: string;
  content_zh: string;
  content_en: string;
  cover_image: string;
  seo_title_zh: string;
  seo_title_en: string;
  seo_description_zh: string;
  seo_description_en: string;
  is_active: number;
  sort_order: number;
}

/** 首页区块条目（服务/品牌卡片） */
export interface HomeSectionItem {
  title_zh: string;
  title_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  image: string;
  url: string;
}

/** 首页区块（sorher 式：hero/categories/services/brands/store） */
export interface HomeSection {
  id: number;
  key: string;
  title_zh: string;
  title_en: string;
  eyebrow_zh: string;
  eyebrow_en: string;
  /** JSON 字符串 [{title_zh,...}] */
  items: string;
  content_zh: string;
  content_en: string;
  image: string;
  /** JSON 字符串，区块级自由配置（按钮、链接、水印、分类筛选等） */
  config: string;
  sort_order: number;
  is_active: number;
}

export interface HomeSectionInput {
  title_zh: string;
  title_en: string;
  eyebrow_zh: string;
  eyebrow_en: string;
  items: string;
  content_zh: string;
  content_en: string;
  image: string;
  /** JSON 字符串，区块级自由配置 */
  config: string;
  sort_order: number;
  is_active: number;
}

/** 站点设置（key-value） */
export interface SiteSetting {
  key: string;
  value: string;
  updated_at: string;
}

/** 管理员账号创建/更新输入 */
export interface AdminUserInput {
  username: string;
  password?: string;
  role: AdminRole;
  email?: string;
}

/** 统一分页结果 */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 各实体的写入模型（校验后的净数据） */
export interface InquiryInput {
  name: string;
  email: string;
  company: string;
  country: string;
  message: string;
  product_ref: string;
}

export interface CategoryInput {
  name_zh: string;
  name_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  cover_image: string;
  sort_order: number;
}

export interface ProductInput {
  category_id: number;
  name_zh: string;
  name_en: string;
  summary_zh: string;
  summary_en: string;
  description_zh: string;
  description_en: string;
  main_image: string;
  /** JSON 字符串数组 */
  images: string;
  sizes: string;
  sizes_en: string;
  colors: string;
  colors_en: string;
  params_zh: string;
  params_en: string;
  seo_title_zh: string;
  seo_title_en: string;
  seo_description_zh: string;
  seo_description_en: string;
  sort_order: number;
  is_active: number;
}

export interface ArticleInput {
  title_zh: string;
  title_en: string;
  summary_zh: string;
  summary_en: string;
  content_zh: string;
  content_en: string;
  cover_image: string;
  seo_title_zh: string;
  seo_title_en: string;
  seo_description_zh: string;
  seo_description_en: string;
  status: 'draft' | 'published';
}

export interface BannerInput {
  image: string;
  title_zh: string;
  title_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  link: string;
  sort_order: number;
}

export interface PageContentInput {
  content_zh: string;
  content_en: string;
  image: string;
}

/** 标签 */
export interface Tag {
  id: number;
  name_zh: string;
  name_en: string;
  slug: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TagInput {
  name_zh: string;
  name_en: string;
  slug: string;
  sort_order: number;
}

/** 媒体库图片 */
export interface Media {
  id: number;
  url: string;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
}
