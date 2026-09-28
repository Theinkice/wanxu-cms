#!/usr/bin/env node
/**
 * 在 CI/CD 部署前自动初始化远程 D1 数据库。
 *
 * - 如果数据库已初始化（site_settings 表存在），只执行 schema.sql（CREATE TABLE IF NOT EXISTS，幂等、不清数据）。
 * - 如果数据库未初始化，先执行 schema.sql 再执行 seed.sql（插入默认管理员、站点设置、演示内容）。
 * - 如果环境变量 ADMIN_PASSWORD 存在，会用 PBKDF2-SHA256（10 万次迭代）重新生成 admin 账号密码哈希。
 *
 * 需要的环境变量：
 *   - CLOUDFLARE_API_TOKEN
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - ADMIN_PASSWORD（可选）
 *
 * 注意：wrangler.toml 里的 __DATABASE_ID__ / __R2_BUCKET_NAME__ / __SITE_URL__ / __ADMIN_PATH__ 占位符
 * 必须已经被替换为真实值（由 replace-wrangler-placeholders.mjs 处理）。
 */

import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const DB_NAME = 'wanxu_cms';
const SCHEMA_FILE = 'db/schema.sql';
const SEED_FILE = 'db/seed.sql';

const ITERATIONS = 100000;
const KEY_LEN_BYTES = 32;
const SALT_LEN_BYTES = 16;

function toHex(buf) {
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN_BYTES));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(plain), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    KEY_LEN_BYTES * 8,
  );
  const hash = new Uint8Array(derived);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function runSilent(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runWithOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

async function main() {
  // 1. 确保 wrangler.toml 占位符已被替换
  const toml = await readFile('wrangler.toml', 'utf8');
  const hasPlaceholder =
    toml.includes('__DATABASE_ID__') ||
    toml.includes('__R2_BUCKET_NAME__') ||
    toml.includes('__SITE_URL__') ||
    toml.includes('__ADMIN_PATH__');

  if (hasPlaceholder) {
    console.error('[init-remote-db] 错误：wrangler.toml 中还有占位符未替换。');
    console.error('请先运行：node scripts/replace-wrangler-placeholders.mjs');
    console.error('并确认已设置 DATABASE_ID、R2_BUCKET_NAME、SITE_URL、ADMIN_PATH 环境变量。');
    process.exit(1);
  }

  // 2. 判断数据库是否已经初始化：site_settings 表是否存在且可查询
  const initialized = runSilent(
    `npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 1 FROM site_settings LIMIT 1"`,
  );

  if (initialized) {
    console.log('[init-remote-db] 数据库已初始化，仅同步 schema（幂等，不会清空现有数据）');
    run(`npx wrangler d1 execute ${DB_NAME} --remote --file=${SCHEMA_FILE}`);
  } else {
    console.log('[init-remote-db] 数据库未初始化，执行 schema + seed（首次部署）');
    run(`npx wrangler d1 execute ${DB_NAME} --remote --file=${SCHEMA_FILE}`);
    run(`npx wrangler d1 execute ${DB_NAME} --remote --file=${SEED_FILE}`);
  }

  // 3. 如果设置了 ADMIN_PASSWORD，更新 admin 用户密码
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminPassword) {
    console.log('[init-remote-db] 检测到 ADMIN_PASSWORD，正在更新 admin 账号密码...');
    const passwordHash = await hashPassword(adminPassword);
    const sql = `UPDATE admin_users SET password_hash = '${passwordHash}' WHERE username = 'admin';`;
    const escapedSql = sql.replace(/'/g, "'\\''");
    run(`npx wrangler d1 execute ${DB_NAME} --remote --command='${escapedSql}'`);
  }

  console.log('[init-remote-db] 完成');
}

main().catch((err) => {
  console.error('[init-remote-db] 失败:', err.message || err);
  process.exit(1);
});
