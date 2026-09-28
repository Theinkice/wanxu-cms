/**
 * 基于 D1 的轻量级 IP 速率限制器
 * - 使用 rate_limits 表记录每个 key 在窗口内的请求次数
 * - 窗口为滑动窗口的简化版：以当前时间戳向下取整到窗口起点
 * - 适用于登录、询盘等需要防暴力刷新的接口
 */

import type { Context } from 'hono';
import type { AppVariables, Bindings } from '../types';

export interface RateLimitRule {
  /** 限制器 key 前缀，如 'login'、'inquiry' */
  prefix: string;
  /** 时间窗口（秒） */
  windowSec: number;
  /** 每个窗口内允许的最大请求数 */
  maxRequests: number;
}

function getClientIP(c: Context<{ Bindings: Bindings; Variables: AppVariables }>): string {
  // Cloudflare 会把真实客户端 IP 放在 cf-connecting-ip
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf;
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  // 本地开发时可能不存在，使用 'unknown' 兜底（不影响本地测试）
  return 'unknown';
}

function makeKey(rule: RateLimitRule, ip: string): string {
  const windowStart = Math.floor(Date.now() / 1000 / rule.windowSec) * rule.windowSec;
  return `${rule.prefix}:${ip}:${windowStart}`;
}

export async function checkRateLimit(
  c: Context<{ Bindings: Bindings; Variables: AppVariables }>,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; retryAfterSec: number; remaining: number }> {
  // 可通过环境变量关闭限流（本地测试时使用），生产环境请勿设置
  const disabled = c.env.RATE_LIMIT_DISABLED === 'true';
  if (disabled) {
    return { allowed: true, retryAfterSec: 0, remaining: rule.maxRequests };
  }

  const db = c.env.DB;
  const ip = getClientIP(c);
  const key = makeKey(rule, ip);

  const row = await db
    .prepare('SELECT count FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number }>();

  const count = row?.count ?? 0;
  if (count >= rule.maxRequests) {
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(nowSec / rule.windowSec) * rule.windowSec;
    const retryAfterSec = windowStart + rule.windowSec - nowSec;
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec), remaining: 0 };
  }

  // 原子递增；若不存在则插入
  await db
    .prepare(
      `INSERT INTO rate_limits (key, count, created_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = count + 1`,
    )
    .bind(key, new Date().toISOString())
    .run();

  return { allowed: true, retryAfterSec: 0, remaining: Math.max(0, rule.maxRequests - count - 1) };
}
