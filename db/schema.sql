-- 晚叙 CMS D1 建表 DDL
-- 时间戳统一为 ISO 8601 UTC 字符串（应用层生成）；布尔用 INTEGER 0/1

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- pbkdf2$100000$<salt_hex>$<hash_hex>
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('super_admin','admin','editor')),
  -- super_admin: 全部权限（含管理员管理、站点设置、导航管理）
  -- admin:        内容管理（轮播/首页内容/分类/产品/文章/询盘），不可管理管理员与设置
  -- editor:       仅文章与询盘
  email TEXT NOT NULL DEFAULT '',        -- 密码找回与通知邮箱
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email) WHERE email <> '';

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,               -- 随机 hex
  admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,             -- ISO 8601，7 天有效
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  subtitle_zh TEXT NOT NULL DEFAULT '',
  subtitle_en TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, id);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  summary_zh TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',   -- HTML
  description_en TEXT NOT NULL DEFAULT '',   -- HTML
  main_image TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',          -- JSON array of image urls
  sizes TEXT NOT NULL DEFAULT '',             -- 逗号分隔（中文）
  sizes_en TEXT NOT NULL DEFAULT '',          -- 逗号分隔（英文）
  colors TEXT NOT NULL DEFAULT '',            -- 逗号分隔（中文）
  colors_en TEXT NOT NULL DEFAULT '',         -- 逗号分隔（英文）
  params_zh TEXT NOT NULL DEFAULT '[]',       -- JSON [{\"key\":..,\"value\":..}] 外贸参数（中文）
  params_en TEXT NOT NULL DEFAULT '[]',       -- JSON [{\"key\":..,\"value\":..}] 外贸参数（英文）
  seo_title_zh TEXT NOT NULL DEFAULT '',
  seo_title_en TEXT NOT NULL DEFAULT '',
  seo_description_zh TEXT NOT NULL DEFAULT '',
  seo_description_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,       -- 1 上架 / 0 下架
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name_zh, name_en);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  summary_zh TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  content_zh TEXT NOT NULL DEFAULT '',        -- HTML
  content_en TEXT NOT NULL DEFAULT '',        -- HTML
  cover_image TEXT NOT NULL DEFAULT '',
  seo_title_zh TEXT NOT NULL DEFAULT '',
  seo_title_en TEXT NOT NULL DEFAULT '',
  seo_description_zh TEXT NOT NULL DEFAULT '',
  seo_description_en TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title_zh, title_en);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  subtitle_zh TEXT NOT NULL DEFAULT '',
  subtitle_en TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS page_contents (
  key TEXT PRIMARY KEY,        -- home_story / home_about / about_page / contact_info / partners_page
  content_zh TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

-- 首页导航（后台可增删改排序；url 为站内路径或完整外链）
-- parent_id：0 表示一级导航；>0 表示挂在某一级导航下的二级导航（下拉菜单）
CREATE TABLE IF NOT EXISTS nav_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL DEFAULT 0,
  label_zh TEXT NOT NULL,
  label_en TEXT NOT NULL,
  url TEXT NOT NULL,                          -- 如 /products 或 https://example.com
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_nav_sort ON nav_items(sort_order, id);

-- 自定义页面（后台"页面管理"可增删改；slug 即前台路由，如 /projects、/certificates）
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,                  -- 站内唯一路径片段（字母/数字/中划线）
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_zh TEXT NOT NULL DEFAULT '',        -- HTML
  content_en TEXT NOT NULL DEFAULT '',        -- HTML
  cover_image TEXT NOT NULL DEFAULT '',
  seo_title_zh TEXT NOT NULL DEFAULT '',
  seo_title_en TEXT NOT NULL DEFAULT '',
  seo_description_zh TEXT NOT NULL DEFAULT '',
  seo_description_en TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,       -- 1 上架 / 0 隐藏
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_title ON pages(title_zh, title_en);

-- 首页区块（sorher 式布局：特色商品/服务项目/品牌/门店，后台逐段编辑）
-- items 为 JSON 条目数组 [{title_zh,title_en,subtitle_zh,subtitle_en,image,url}]
-- config 为区块级自由配置（按钮文案/链接、分类筛选、水印文字等）
CREATE TABLE IF NOT EXISTS home_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,                    -- hero/categories/services/brands/store
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  eyebrow_zh TEXT NOT NULL DEFAULT '',
  eyebrow_en TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',            -- 卡片/条目（服务、品牌、统计等）
  content_zh TEXT NOT NULL DEFAULT '',         -- 富文本（门店信息等）
  content_en TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',              -- 配图（门店等）
  config TEXT NOT NULL DEFAULT '{}',           -- 自由配置 JSON
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_home_sections_sort ON home_sections(sort_order, id);

-- 站点设置（key-value，value 为字符串；JSON 值自行序列化）
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  product_ref TEXT NOT NULL DEFAULT '',   -- 来源产品名（产品详情页带入）
  source TEXT NOT NULL DEFAULT 'site' CHECK (source IN ('site','email')),  -- site=站内表单；email=邮件渠道转入
  mail_sent INTEGER NOT NULL DEFAULT 0,   -- 邮件通知是否已发送
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);

-- 标签（中英名称 + URL 标识）
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tags_sort ON tags(sort_order, id);

-- 标签与内容关联（产品 / 文章 / 独立页面）
CREATE TABLE IF NOT EXISTS product_tags (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE TABLE IF NOT EXISTS page_tags (
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- 媒体库（已上传图片记录）
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,                          -- /media/uploads/... 访问路径
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,            -- 字节
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);

-- 密码重置令牌
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,               -- 随机 hex 令牌
  admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,             -- ISO 8601 UTC
  used INTEGER NOT NULL DEFAULT 0,      -- 0=未使用 / 1=已使用
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_admin ON password_resets(admin_id, used, expires_at);

-- IP 速率限制（登录、询盘等）
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,                 -- 如 login:1.2.3.4:1695897600
  count INTEGER NOT NULL DEFAULT 1,     -- 当前窗口内请求次数
  created_at TEXT NOT NULL              -- ISO 8601 UTC
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created ON rate_limits(created_at);
