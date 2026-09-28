/**
 * 开发者修改验证：回答问题后获得短时 cookie 令牌
 * - 问题与答案可通过环境变量 DEV_CHALLENGE_QUESTION / DEV_CHALLENGE_ANSWER 配置
 * - 答案忽略大小写、http(s):// 前缀和末尾斜杠
 * - 令牌为 HMAC-SHA256 签名的过期时间戳
 */

import { getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { Bindings } from '../types';

export const DEV_COOKIE = 'wanxu_dev_ok';
// 默认问题不再依赖公开信息（如邮箱前缀），默认答案为随机串，部署后请务必通过环境变量自定义
const DEFAULT_QUESTION = '请输入本系统默认的开发者验证答案（部署后请在环境变量中设置）';
const DEFAULT_ANSWER = 'wanxu-change-me-7f3a9b2e';
const DEFAULT_SECRET = 'wanxu-dev-challenge-default-secret-change-in-production';
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 分钟

function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .trim();
}

export function getDevQuestion(env?: Bindings): string {
  return env?.DEV_CHALLENGE_QUESTION || DEFAULT_QUESTION;
}

export function getDevAnswer(env?: Bindings): string {
  return env?.DEV_CHALLENGE_ANSWER || DEFAULT_ANSWER;
}

export function verifyDevAnswer(input: string, env?: Bindings): boolean {
  return normalizeAnswer(input) === normalizeAnswer(getDevAnswer(env));
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function importKey(secret: string) {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign', 'verify'],
  );
}

export async function signDevToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const data = String(expiresAt);
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${expiresAt}|${bufToHex(sig)}`;
}

export async function verifyDevToken(secret: string, token: string): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.indexOf('|') === -1) return false;
  const [expiresStr, sigHex] = token.split('|');
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const sigBytes = new Uint8Array(
    (sigHex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)),
  );
  if (sigBytes.length === 0) return false;

  const key = await importKey(secret);
  const data = new TextEncoder().encode(String(expiresAt));
  return crypto.subtle.verify('HMAC', key, sigBytes, data);
}

function cookieOptions(c: Context) {
  return {
    path: '/',
    httpOnly: true, // 服务端验证即可，前端只需通过存在性判断是否已验证
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax' as const,
    maxAge: 30 * 60,
  };
}

/** 构造 Set-Cookie 字符串（ok()/fail() 会新建 Response，c.header 会丢失，所以手动 append） */
export async function buildDevChallengeCookie(
  c: Context,
  secret?: string,
): Promise<string> {
  const token = await signDevToken(secret || c.env.DEV_CHALLENGE_SECRET || DEFAULT_SECRET);
  const opts = cookieOptions(c);
  const parts = [`${DEV_COOKIE}=${encodeURIComponent(token)}`, `Path=${opts.path}`, `Max-Age=${opts.maxAge}`];
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite}`);
  return parts.join('; ');
}

export function clearDevChallengeCookie(c: Context): void {
  setCookie(c, DEV_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function isDevChallengePassed(c: Context): Promise<boolean> {
  const token = getCookie(c, DEV_COOKIE);
  if (!token) return false;
  const secret = c.env.DEV_CHALLENGE_SECRET || DEFAULT_SECRET;
  return verifyDevToken(secret, token);
}

/**
 * 校验开发者挑战：先看 cookie 令牌，再看 body.answer
 * 若 body.answer 正确，会自动设置 cookie
 */
export async function requireDevChallenge(
  c: Context,
  body: Record<string, unknown> | null,
): Promise<{ ok: boolean; message?: string; cookie?: string }> {
  const secret = c.env.DEV_CHALLENGE_SECRET || DEFAULT_SECRET;
  const cookie = getCookie(c, DEV_COOKIE);
  if (cookie && (await verifyDevToken(secret, cookie))) {
    return { ok: true };
  }

  const answer = typeof body?.answer === 'string' ? body.answer : '';
  if (!answer) {
    return { ok: false, message: '请先正确回答开发者验证问题' };
  }
  if (!verifyDevAnswer(answer, c.env)) {
    return { ok: false, message: '回答错误' };
  }
  const cookieStr = await buildDevChallengeCookie(c, secret);
  return { ok: true, cookie: cookieStr };
}
