#!/usr/bin/env node
/**
 * 在 CI/CD 部署前，用环境变量替换 wrangler.toml 里的占位符。
 * 这样可以避免把 database_id、bucket_name、SITE_URL 等真实配置写入 GitHub 仓库。
 *
 * 需要的环境变量（均可在 GitHub Secrets / Cloudflare 环境变量里设置）：
 *   - DATABASE_ID            : D1 数据库的 UUID
 *   - R2_BUCKET_NAME         : R2 存储桶名称
 *   - SITE_URL               : 站点正式域名，例如 https://www.yoursite.com
 *   - ADMIN_PATH             : 后台访问入口路径，默认 /admin（可改为 /manage 等）
 *   - GEO_REDIRECT           : 'true' 则根据中国 IP 自动跳转 /zh，默认 true
 *   - DEV_CHALLENGE_SECRET   : 开发者验证签名密钥（生产环境必须修改）
 *   - DEV_CHALLENGE_ANSWER   : 开发者验证答案（生产环境必须修改）
 *
 * 本地开发时，如果这些环境变量没设置，脚本会保留默认占位值，不影响本地 dev。
 */

import { readFile, writeFile } from 'node:fs/promises';

const WRANGLER_FILE = 'wrangler.toml';

const databaseId = process.env.DATABASE_ID?.trim() || '00000000-0000-0000-0000-000000000000';
const r2BucketName = process.env.R2_BUCKET_NAME?.trim() || 'wanxu-cms-media';
const siteUrl = process.env.SITE_URL?.trim() || 'https://www.example.com';
let adminPath = process.env.ADMIN_PATH?.trim() || '/admin';
// 兼容部分 shell/Git Bash 会把 /manage 自动解析为 Windows 盘符路径的情况
if (/^[a-zA-Z]:[\\/]/.test(adminPath)) {
  const parts = adminPath.replace(/\\/g, '/').split('/').filter(Boolean);
  adminPath = '/' + (parts.pop() || 'admin');
}
if (!adminPath.startsWith('/')) adminPath = `/${adminPath}`;
const geoRedirect = process.env.GEO_REDIRECT?.trim() || 'true';
const devChallengeSecret = process.env.DEV_CHALLENGE_SECRET?.trim() || 'wanxu-dev-challenge-default-secret-change-in-production';
const devChallengeAnswer = process.env.DEV_CHALLENGE_ANSWER?.trim() || 'wanxu-change-me-7f3a9b2e';

let content = await readFile(WRANGLER_FILE, 'utf8');

content = content.replace(/__DATABASE_ID__/g, databaseId);
content = content.replace(/__R2_BUCKET_NAME__/g, r2BucketName);
content = content.replace(/__SITE_URL__/g, siteUrl);
content = content.replace(/__ADMIN_PATH__/g, adminPath);
content = content.replace(/__GEO_REDIRECT__/g, geoRedirect);
content = content.replace(/__DEV_CHALLENGE_SECRET__/g, devChallengeSecret);
content = content.replace(/__DEV_CHALLENGE_ANSWER__/g, devChallengeAnswer);

await writeFile(WRANGLER_FILE, content);

console.log('[replace-wrangler-placeholders] wrangler.toml 已更新');
console.log(`  DATABASE_ID            = ${databaseId}`);
console.log(`  R2_BUCKET_NAME         = ${r2BucketName}`);
console.log(`  SITE_URL               = ${siteUrl}`);
console.log(`  ADMIN_PATH             = ${adminPath}`);
console.log(`  GEO_REDIRECT           = ${geoRedirect}`);
console.log(`  DEV_CHALLENGE_SECRET   = ${devChallengeSecret.includes('default') ? devChallengeSecret + ' (⚠️ 生产环境请修改)' : '***'}`);
console.log(`  DEV_CHALLENGE_ANSWER   = ${devChallengeAnswer.includes('change-me') ? devChallengeAnswer + ' (⚠️ 生产环境请修改)' : '***'}`);
