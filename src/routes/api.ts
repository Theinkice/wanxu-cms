/**
 * 公开 API（无鉴权）：POST /api/inquiries 询盘提交
 * 服务端二次校验（前端 site.js 已做一遍）
 */

import { Hono } from 'hono';
import type { AppVariables, Bindings } from '../types';
import { fail, ok } from '../lib/http';
import { validateInquiry } from '../lib/validate';
import { InquiryRepo, SettingsRepo, SearchRepo } from '../lib/repo';
import { sendInquiryEmail } from '../lib/mailer';
import { checkRateLimit } from '../lib/rateLimit';

export const api = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

/** 站点公开信息（用于管理后台登录页展示开发者信息等，不含敏感数据） */
api.get('/site', async (c) => {
  const s = await SettingsRepo.getAll(c.env.DB);
  // 公开接口不再返回开发者邮箱/微信，降低信息泄露与社工面；登录页仅展示名称、网址、二维码
  return ok({
    site_name: s.site_name || '',
    site_name_zh: s.site_name_zh || '',
    logo_image: s.logo_image || '',
    logo_image_zh: s.logo_image_zh || '',
    dev_name: s.dev_name || '',
    dev_url: s.dev_url || '',
    dev_wechat_qr: s.dev_wechat_qr || '',
  });
});

/** 全站搜索：产品 + 文章 + 页面，按当前语言返回 */
api.get('/search', async (c) => {
  const q = c.req.query('q') || '';
  const lang = c.req.query('lang') === 'zh' ? 'zh' : 'en';
  if (!q.trim()) return ok({ query: q, results: [] });
  const results = await SearchRepo.search(c.env.DB, lang, q.trim());
  return ok({ query: q, results });
});

api.post('/inquiries', async (c) => {
  // 询盘频率限制：同 IP 10 分钟最多 5 次提交，防止邮件/数据库轰炸
  const limit = await checkRateLimit(c, { prefix: 'inquiry', windowSec: 600, maxRequests: 5 });
  if (!limit.allowed) {
    return fail(429, '提交过于频繁，请稍后再试', 429);
  }

  let body: Record<string, unknown> | null = null;
  try {
    const raw = await c.req.json();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      body = raw as Record<string, unknown>;
    }
  } catch {
    body = null;
  }
  if (!body) return fail(400, '请求体格式错误', 400);

  const { errors, value } = validateInquiry(body);
  if (Object.keys(errors).length > 0) {
    return fail(400, '参数校验失败', 400, { errors });
  }

  const id = await InquiryRepo.create(c.env.DB, value, 'site');

  // 邮件询盘：异步发送通知邮件，不阻塞响应；结果记录 mail_sent
  c.executionCtx.waitUntil(
    (async () => {
      const recipient = await SettingsRepo.get(c.env.DB, 'inquiry_recipient');
      const inquiry = await InquiryRepo.findById(c.env.DB, id);
      if (!inquiry) return;
      const result = await sendInquiryEmail(c.env, inquiry, recipient);
      await InquiryRepo.markMailSent(c.env.DB, id, result.sent);
    })(),
  );

  return ok({ id });
});
