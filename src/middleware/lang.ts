/**
 * 语言中间件：解析 /:lang，校验 ∈ {en, zh} 并注入 c.set('lang')
 * 非法语言前缀 → 302 到 /en 对应路径
 */

import { createMiddleware } from 'hono/factory';
import type { AppVariables, Bindings, Lang } from '../types';

export const langMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: AppVariables;
}>(async (c, next) => {
  // 前台子应用挂载在 /en 与 /zh 两处，从路径首段判定语言
  const seg = c.req.path.split('/')[1] ?? '';
  if (seg !== 'en' && seg !== 'zh') {
    const url = new URL(c.req.url);
    const rest = url.pathname.replace(/^\/[^/]+/, '') || '/';
    return c.redirect(`/en${rest}${url.search}`, 302);
  }
  c.set('lang', seg as Lang);

  // 记录用户语言偏好到 cookie，方便根路径按偏好跳转
  const cookie = c.req.header('cookie') || '';
  const hasCookie = new RegExp(`(?:^|;\\s*)wanxu_lang=${seg}(?:;|$)`).test(cookie);
  if (!hasCookie) {
    c.header('set-cookie', `wanxu_lang=${seg}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }

  await next();
});
