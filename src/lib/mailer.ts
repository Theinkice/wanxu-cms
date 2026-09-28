/**
 * 询盘邮件通知：站内询盘提交后，异步转发到管理员邮箱（"邮件询盘"功能）
 *
 * 通过环境变量配置（见 docs/DEPLOY.md）：
 * - EMAIL_API_URL    通用邮件 Webhook 地址（Resend / Mailgun / 自建转发服务均可，
 *                    请求体为 JSON：{from, to[], subject, html, text}）
 * - EMAIL_API_TOKEN  可选，Bearer 认证令牌
 * - EMAIL_FROM       可选，发件人地址（默认 no-reply@<SITE_URL 域名>）
 * - 收件人读取 site_settings.inquiry_recipient（后台"站点设置"可改）
 *
 * 未配置 EMAIL_API_URL 时静默跳过（询盘仍正常入库），不阻塞前台响应。
 */

import type { Bindings, Inquiry } from '../types';

export interface MailResult {
  sent: boolean;
  reason?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultFrom(env: Bindings): string {
  if (env.EMAIL_FROM) return env.EMAIL_FROM;
  try {
    const host = new URL(env.SITE_URL).hostname;
    return `no-reply@${host}`;
  } catch {
    return 'no-reply@wanxu-cms.local';
  }
}

async function sendEmail(
  env: Bindings,
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<MailResult> {
  if (!env.EMAIL_API_URL) return { sent: false, reason: 'EMAIL_API_URL 未配置' };
  if (!to.length) return { sent: false, reason: '收件人未配置' };

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (env.EMAIL_API_TOKEN) headers.authorization = `Bearer ${env.EMAIL_API_TOKEN}`;
    const res = await fetch(env.EMAIL_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: defaultFrom(env),
        to,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) return { sent: false, reason: `邮件服务返回 ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : '网络错误' };
  }
}

export async function sendInquiryEmail(
  env: Bindings,
  inquiry: Inquiry,
  recipient: string,
): Promise<MailResult> {
  if (!env.EMAIL_API_URL) return { sent: false, reason: 'EMAIL_API_URL 未配置' };
  if (!recipient) return { sent: false, reason: '收件人未配置' };

  const subject = `【晚叙 CMS 询盘】${inquiry.name} - ${inquiry.product_ref || inquiry.company || '新询盘'}`;
  const rows = [
    ['姓名', inquiry.name],
    ['邮箱', inquiry.email],
    ['公司', inquiry.company || '-'],
    ['国家', inquiry.country || '-'],
    ['来源产品', inquiry.product_ref || '-'],
    ['询盘内容', inquiry.message],
  ];
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6">
    <h2>收到新的站内询盘</h2>
    <table cellpadding="8" style="border-collapse:collapse">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="border:1px solid #ddd;color:#666;white-space:nowrap">${escapeHtml(k)}</td>
             <td style="border:1px solid #ddd">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}
    </table>
    <p style="color:#999;font-size:12px">此邮件由晚叙 CMS 自动发送，请登录后台查看详情。</p>
  </body></html>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  return sendEmail(env, [recipient], subject, html, text);
}

/** 发送密码重置邮件 */
export async function sendPasswordResetEmail(
  env: Bindings,
  recipient: string,
  resetUrl: string,
): Promise<MailResult> {
  const subject = '【晚叙 CMS】密码重置请求';
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6">
    <h2>密码重置</h2>
    <p>你刚才请求重置晚叙 CMS 管理后台的登录密码。点击下方按钮完成重置（30 分钟内有效）：</p>
    <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 24px;background:#166534;color:#fff;text-decoration:none;border-radius:8px;">重置密码</a></p>
    <p style="color:#666">如果按钮无法点击，请复制以下链接到浏览器打开：</p>
    <p style="word-break:break-all;color:#166534">${escapeHtml(resetUrl)}</p>
    <p style="color:#999;font-size:12px">如果你没有请求重置密码，请忽略此邮件。</p>
  </body></html>`;
  const text = `密码重置

请点击以下链接重置密码（30 分钟内有效）：
${resetUrl}

如果你没有请求重置密码，请忽略此邮件。`;

  return sendEmail(env, [recipient], subject, html, text);
}
