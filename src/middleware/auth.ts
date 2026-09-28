/**
 * 管理端鉴权中间件：校验 wanxu_admin Cookie 中的会话令牌
 * 挂载于 /api/admin/*；POST /api/admin/login 显式排除
 * 通过后将当前管理员注入 c.set('admin')
 *
 * RBAC 权限矩阵（管理员等级）：
 * - super_admin：全部模块，含 管理员管理 / 站点设置 / 导航管理
 * - admin：       轮播、首页内容、分类、产品、文章、询盘（不可管理管理员与站点设置、导航）
 * - editor：      文章、询盘
 */

import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { AdminRole, AppVariables, Bindings } from '../types';
import { AuthService } from '../lib/repo';
import { fail } from '../lib/http';

export const ADMIN_COOKIE = 'wanxu_admin';

/** 模块 → 允许访问的最低角色等级（索引越大权限越低） */
const ROLE_LEVEL: Record<AdminRole, number> = { super_admin: 0, admin: 1, editor: 2 };

export const MODULE_ROLES: Record<string, AdminRole> = {
  dashboard: 'editor',
  banners: 'admin',
  'home-content': 'admin',
  categories: 'admin',
  products: 'admin',
  pages: 'admin',
  articles: 'editor',
  inquiries: 'editor',
  navigation: 'super_admin',
  settings: 'super_admin',
  admins: 'super_admin',
  media: 'admin',
  tags: 'admin',
};

/** 需要 super_admin 的路径前缀（兜底，双保险） */
const SUPER_ONLY_PREFIXES = ['/api/admin/admins', '/api/admin/settings', '/api/admin/nav'];

export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: AppVariables;
}>(async (c, next) => {
  // 登录 / 找回密码 / 重置密码 接口本身不需要鉴权
  const publicPaths = ['/api/admin/login', '/api/admin/forgot-password', '/api/admin/reset-password'];
  if (publicPaths.includes(c.req.path) && c.req.method === 'POST') {
    await next();
    return;
  }
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token) {
    return fail(401, '未登录或会话已过期', 401);
  }
  const admin = await AuthService.resolveSession(c.env.DB, token);
  if (!admin) {
    return fail(401, '未登录或会话已过期', 401);
  }

  // RBAC：路径级权限校验
  const path = c.req.path;
  const isSuperOnly = SUPER_ONLY_PREFIXES.some((p) => path.startsWith(p));
  if (isSuperOnly && admin.role !== 'super_admin') {
    return fail(403, '权限不足：该功能仅超级管理员可用', 403);
  }

  c.set('admin', admin);
  await next();
});

/** 校验当前管理员是否满足模块最低角色要求（在处理器内调用） */
export function requireModuleRole(adminRole: AdminRole, module: string): boolean {
  const required = MODULE_ROLES[module] ?? 'super_admin';
  return ROLE_LEVEL[adminRole] <= ROLE_LEVEL[required];
}
