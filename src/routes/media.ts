/**
 * R2 图片回源：GET /media/* → BUCKET.get(key)
 * 不开 R2 公网域名；key 内含 UUID，内容永不复用，故强缓存一年
 */

import { Hono } from 'hono';
import type { AppVariables, Bindings } from '../types';
import { fail } from '../lib/http';
import { shouldInline } from '../lib/fileVerify';

export const media = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

media.get('*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '');
  if (!key || key.includes('..')) {
    return fail(404, 'Not Found', 404);
  }
  const obj = await c.env.BUCKET.get(key);
  if (!obj) {
    return fail(404, 'Not Found', 404);
  }
  const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream';
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  // 禁止浏览器 MIME 嗅探，降低伪装文件被当作 HTML 执行的风险
  headers.set('X-Content-Type-Options', 'nosniff');
  // 非图片/PDF/文本文件强制下载，避免在浏览器中直接打开 Office/压缩包等
  if (!shouldInline(ext)) {
    const filename = key.split('/').pop() || 'download';
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  }
  headers.set('ETag', obj.httpEtag);
  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { headers });
});
