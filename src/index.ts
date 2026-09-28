/**
 * Worker 入口：Hono app、中间件挂载、路由注册、统一 404/500
 * 路由分层：/:lang 前台 SSR | /api 公开 API | /api/admin 管理 API | /media R2 回源
 * 静态资源（/css /js /favicon /admin 原始目录）由 wrangler [assets] 直接托管；后台入口路径（ADMIN_PATH）由 Worker 动态映射
 */

import { Hono, type Context } from 'hono';
import type { AppVariables, Bindings, Lang } from './types';
import { authMiddleware } from './middleware/auth';
import { frontend, homeHandler, robotsHandler, sitemapHandler } from './routes/frontend';
import { langMiddleware } from './middleware/lang';
import { api } from './routes/api';
import { adminApi } from './routes/adminApi';
import { media } from './routes/media';
import { fail } from './lib/http';
import { t } from './i18n/ui';

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

/** 统一安全响应头 */
function setSecurityHeaders(c: Context, path: string) {
  const isApi = path.startsWith('/api/');
  const isMedia = path.startsWith('/media/');

  // 强制 HTTPS（仅线上 HTTPS 生效）
  const secure = new URL(c.req.url).protocol === 'https:';
  if (secure) {
    c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // 禁止 MIME 嗅探
  c.header('X-Content-Type-Options', 'nosniff');

  // API / 媒体流只需基础头，不需要 CSP / 帧控制
  if (isApi || isMedia) {
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    return;
  }

  // 防止点击劫持
  c.header('X-Frame-Options', 'DENY');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self';");
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/** 检测默认语言：先读 cookie 偏好，再按 Cloudflare IP 国家判断（CN→zh，其它→en） */
function detectDefaultLang(c: Context<{ Bindings: Bindings; Variables: AppVariables }>): Lang {
  // 1. 尊重用户手动切换后留下的 cookie 偏好
  const cookie = c.req.header('cookie') || '';
  const cookieMatch = cookie.match(/(?:^|;\s*)wanxu_lang=(zh|en)/i);
  if (cookieMatch) return cookieMatch[1].toLowerCase() as Lang;

  // 2. 如果关闭了 GEO 跳转，直接默认英文
  const geoRedirect = c.env.GEO_REDIRECT ?? 'true';
  if (geoRedirect === 'false') return 'en';

  // 3. Cloudflare 会在请求头里带上访问者国家代码（如 CN、US、JP）
  const country = c.req.header('cf-ipcountry')?.toUpperCase();
  if (country === 'CN') return 'zh';
  return 'en';
}

/** 规范化后台入口路径：必须以 / 开头，去掉末尾斜杠 */
function normalizeAdminPath(raw: string | undefined): string {
  let p = raw?.trim() || '/admin';
  if (!p.startsWith('/')) p = `/${p}`;
  return p.replace(/\/$/, '') || '/admin';
}

// ---- 后台入口动态映射（ADMIN_PATH 可配置为 /manage 等，同时隐藏默认 /admin）----
app.use('*', async (c, next) => {
  const adminPath = normalizeAdminPath(c.env.ADMIN_PATH);
  const path = new URL(c.req.url).pathname;

  // 默认 /admin：只把裸 /admin 和 /admin/ 映射到 index.html，其他静态资源继续走 wrangler assets
  if (adminPath === '/admin') {
    if (path === '/admin' || path === '/admin/') {
      const asset = await c.env.ASSETS.fetch(new URL('/admin/index.html', c.req.url));
      return asset;
    }
    await next();
    return;
  }

  // 自定义 ADMIN_PATH：把 ADMIN_PATH/* 映射到 /admin/*
  if (path === adminPath || path === `${adminPath}/`) {
    const asset = await c.env.ASSETS.fetch(new URL('/admin/index.html', c.req.url));
    return asset;
  }
  if (path.startsWith(`${adminPath}/`)) {
    const relative = path.slice(adminPath.length);
    const asset = await c.env.ASSETS.fetch(new URL(`/admin${relative}`, c.req.url));
    return asset;
  }

  // 自定义 ADMIN_PATH 时，隐藏默认 /admin 入口
  if (path === '/admin' || path === '/admin/' || path.startsWith('/admin/')) {
    return c.notFound();
  }

  await next();
});

// ---- 统一安全响应头（在请求处理完后追加）----
app.use('*', async (c, next) => {
  await next();
  setSecurityHeaders(c, new URL(c.req.url).pathname);
});

// ---- 默认语言重定向：根路径与裸路径 → 按国家/地区自动选择中文或英文 ----
app.get('/', (c) => {
  const lang = detectDefaultLang(c);
  return c.redirect(`/${lang}/`, 302);
});
for (const p of ['products', 'news', 'about', 'contact']) {
  app.get(`/${p}`, (c) => {
    const lang = detectDefaultLang(c);
    return c.redirect(`/${lang}/${p}`, 302);
  });
  app.get(`/${p}/*`, (c) => {
    const lang = detectDefaultLang(c);
    const url = new URL(c.req.url);
    return c.redirect(`/${lang}${url.pathname}${url.search}`, 302);
  });
}

// ---- SEO 端点 ----
app.get('/sitemap.xml', sitemapHandler);
app.get('/robots.txt', robotsHandler);

// ---- 管理 API 鉴权（POST /api/admin/login 在中间件内部排除）----
app.use('/api/admin/*', authMiddleware);

// ---- 路由挂载 ----
app.route('/media', media);
app.route('/api', api);
app.route('/api/admin', adminApi);
// 前台双语（显式挂载两个语言前缀，避免参数化 basePath 的匹配歧义）
app.route('/en', frontend);
app.route('/zh', frontend);
// hono 子应用 get('/') 仅匹配 '/en' 不匹配 '/en/'，带尾斜杠首页在此显式注册
app.get('/en/', langMiddleware, homeHandler);
app.get('/zh/', langMiddleware, homeHandler);

// ---- 统一 404（含非法语言前缀 → /en 重定向）----
app.notFound((c) => {
  const adminPath = normalizeAdminPath(c.env.ADMIN_PATH);
  const SYSTEM_ROOTS = ['/api', '/media', adminPath, '/css', '/js', '/favicon.svg', '/sitemap.xml', '/robots.txt'];

  const url = new URL(c.req.url);
  const path = url.pathname;
  if (path.startsWith('/api/')) {
    return fail(404, 'Not Found', 404);
  }
  const isSystem = SYSTEM_ROOTS.some((r) => path === r || path.startsWith(`${r}/`));
  const isLang = path === '/en' || path === '/zh' || path.startsWith('/en/') || path.startsWith('/zh/');
  if (!isSystem && !isLang) {
    // 无语言前缀或非法语言前缀 → 重定向到 /en 对应路径
    const segs = path.split('/').filter(Boolean);
    if (segs.length === 0) return c.redirect(`/${detectDefaultLang(c)}/`, 302);
    const first = segs[0];
    if (/^[a-z]{2}$/i.test(first)) {
      // 首段为语言代码（如 /fr/contact）→ 去掉后接默认语言前缀
      const rest = '/' + segs.slice(1).join('/');
      return c.redirect(`/${detectDefaultLang(c)}${rest}${url.search}`, 302);
    }
    // 首段为站内路径（如 /projects、/about）→ 整体补默认语言前缀
    return c.redirect(`/${detectDefaultLang(c)}${path}${url.search}`, 302);
  }
  const lang: Lang = path.startsWith('/zh') ? 'zh' : 'en';
  const html = `<!DOCTYPE html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t(lang, 'notfound_title')} | ${t(lang, 'site_name')}</title>
<link rel="stylesheet" href="/css/site.css" />
</head>
<body>
<main class="container" style="padding:80px 20px;text-align:center;">
  <h1 style="font-size:42px;color:#1b5e20;margin-bottom:16px;">404</h1>
  <h2 style="margin-bottom:12px;">${t(lang, 'notfound_title')}</h2>
  <p style="color:#6b7280;margin-bottom:24px;">${t(lang, 'notfound_desc')}</p>
  <a class="btn btn-primary" href="/${lang}/">${t(lang, 'back_home')}</a>
</main>
</body>
</html>`;
  return c.html(html, 404);
});

// ---- 统一 500 ----
app.onError((err, c) => {
  console.error('[wanxu-cms] unhandled error:', err);
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/')) {
    return fail(500, 'Internal Server Error', 500);
  }
  const lang: Lang = path.startsWith('/zh') ? 'zh' : 'en';
  const html = `<!DOCTYPE html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t(lang, 'server_error_title')} | ${t(lang, 'site_name')}</title>
<link rel="stylesheet" href="/css/site.css" />
</head>
<body>
<main class="container" style="padding:80px 20px;text-align:center;">
  <h1 style="font-size:42px;color:#1b5e20;margin-bottom:16px;">500</h1>
  <h2 style="margin-bottom:12px;">${t(lang, 'server_error_title')}</h2>
  <p style="color:#6b7280;margin-bottom:24px;">${t(lang, 'server_error_desc')}</p>
  <a class="btn btn-primary" href="/${lang}/">${t(lang, 'back_home')}</a>
</main>
</body>
</html>`;
  return c.html(html, 500);
});

export default app;
