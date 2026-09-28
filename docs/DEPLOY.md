# 晚叙 CMS v1.0.0 · Cloudflare 部署教程

基于 Cloudflare Workers（Hono + D1 + R2 + Assets），无需传统服务器，全程可云端完成。

---

## 一、前置准备

1. 准备一个 Cloudflare 账号
2. 可选：本机安装 Node.js ≥ 18（若使用命令行创建 D1/R2）
3. 把代码推送到 GitHub 仓库（详见 README.md）

---

## 二、创建云端资源

### 2.1 创建 D1 数据库

**方式 A：命令行**

```bash
npx wrangler login
npx wrangler d1 create wanxu_cms
```

记录返回的 `database_id`。

**方式 B：Cloudflare 控制台**

1. 打开 https://dash.cloudflare.com
2. 左侧主导航 → **「Workers 和 Pages」** → **「D1 数据库」**
3. 点击 **「创建数据库」**，名称填 `wanxu_cms`
4. 进入详情页，复制页面上的 UUID

### 2.2 创建 R2 存储桶

**方式 A：命令行**

```bash
npx wrangler r2 bucket create wanxu-cms-media
```

**方式 B：Cloudflare 控制台**

1. 左侧主导航 → **「R2」**
2. 点击 **「创建存储桶」**，名称填 `wanxu-cms-media`

> R2 桶名全局唯一。若被占用，请换一个唯一名字（如 `wanxu-cms-media-你的用户名`），并同步修改环境变量 `R2_BUCKET_NAME`。

---

## 三、配置环境变量

项目使用占位符 + 环境变量注入，避免把真实配置写入仓库。

`wrangler.toml` 中的占位符：

```toml
[[d1_databases]]
database_id = "__DATABASE_ID__"

[[r2_buckets]]
bucket_name = "__R2_BUCKET_NAME__"

[vars]
SITE_URL = "__SITE_URL__"
ADMIN_PATH = "__ADMIN_PATH__"
GEO_REDIRECT = "__GEO_REDIRECT__"
DEV_CHALLENGE_SECRET = "__DEV_CHALLENGE_SECRET__"
DEV_CHALLENGE_ANSWER = "__DEV_CHALLENGE_ANSWER__"
```

**环境变量清单**：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_ID` | 是 | D1 数据库 UUID |
| `R2_BUCKET_NAME` | 是 | R2 存储桶名称 |
| `SITE_URL` | 是 | 正式域名，如 `https://www.yoursite.com` |
| `ADMIN_PATH` | 否 | 后台入口，默认 `/admin` |
| `ADMIN_PASSWORD` | 否 | admin 初始密码，默认 `Admin@12345` |
| `GEO_REDIRECT` | 否 | 默认 `true`；中国 IP 访问 `/` 自动跳 `/zh` |
| `DEV_CHALLENGE_SECRET` | 否 | 开发者验证签名密钥，**生产环境强烈建议设置** |
| `DEV_CHALLENGE_ANSWER` | 否 | 修改开发者联系方式答案，**生产环境强烈建议设置** |
| `RATE_LIMIT_DISABLED` | 否 | 仅本地测试填 `true`，生产环境切勿设置 |

**配置位置**：

- **Cloudflare Workers Builds**：Cloudflare 控制台 → Worker → **「构建设置」** → **「环境变量」**
- **GitHub Actions**：GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**

---

## 四、部署

### 方式 A：Cloudflare Workers Builds（推荐）

1. Cloudflare 控制台 → **「Workers 和 Pages」** → **「创建应用程序」**
2. 选择 **「通过 Git 连接」**，授权并选择 `wanxu-cms` 仓库、`main` 分支
3. 添加环境变量（见第三节）
4. 填写：
   - **构建命令**：`node scripts/replace-wrangler-placeholders.mjs && npm run build`
   - **部署命令**：`node scripts/init-remote-db.mjs && npm run deploy`
5. 点击 **「保存并部署」**
6. 等待成功后，页面会显示 `https://wanxu-cms.<子域>.workers.dev`

首次部署会自动执行 `db/schema.sql` 建表 + `db/seed.sql` 写入默认数据；后续部署只同步 `schema.sql`，不会清空数据。

### 方式 B：GitHub Actions

仓库已内置 `.github/workflows/deploy.yml`。在 GitHub 配置好 Secrets 后，每次 `git push` 到 `main` 会自动：

1. 替换 `wrangler.toml` 占位符
2. TypeScript 类型检查
3. 自动创建 R2 存储桶（已存在则忽略）
4. 初始化/同步 D1 数据库
5. `wrangler deploy` 部署

---

## 五、绑定自定义域名

1. Cloudflare Dashboard → **Workers 和 Pages** → 点击 `wanxu-cms`
2. **「设置」** → **「触发器」/「域和路由」** → **「添加自定义域」**
3. 输入域名（如 `www.yoursite.com`），等待 1~2 分钟生效
4. 把环境变量 `SITE_URL` 改为 `https://www.yoursite.com` 并重新部署

> 域名必须已接入 Cloudflare DNS。

---

## 六、邮件通知配置

询盘提交与密码找回需要邮件服务。Cloudflare Workers 不支持原生 SMTP，统一走通用 HTTP Webhook：Worker 向 `EMAIL_API_URL` POST JSON `{from, to[], subject, html, text}`。

配置以下 Secrets（GitHub Actions）或环境变量（Workers Builds）：

| 变量 | 说明 |
|---|---|
| `EMAIL_API_URL` | 邮件 Webhook 地址 |
| `EMAIL_API_TOKEN` | Bearer 令牌 |
| `EMAIL_FROM` | 发件人邮箱 |

### 6.1 使用 Resend（推荐）

```
EMAIL_API_URL=https://api.resend.com/emails
EMAIL_API_TOKEN=re_xxx
EMAIL_FROM=no-reply@your-domain.com
```

### 6.2 自建 SMTP 网关

若使用 mxroute 等 SMTP 服务，可自建一个 HTTP → SMTP 转发网关，例如：

```js
import { createServer } from 'node:http';
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const RELAY_TOKEN = process.env.RELAY_TOKEN;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/send') {
    res.writeHead(404).end('not found');
    return;
  }
  const auth = req.headers.authorization || '';
  if (RELAY_TOKEN && auth.replace(/^Bearer\s+/i, '') !== RELAY_TOKEN) {
    res.writeHead(401).end('unauthorized');
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    try {
      const { from, to, subject, html, text } = JSON.parse(body);
      await transporter.sendMail({ from, to, subject, html, text });
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500).end(JSON.stringify({ error: e.message }));
    }
  });
}).listen(process.env.PORT || 3000);
```

部署后把 Worker 邮件变量指向该网关：

```
EMAIL_API_URL=https://your-relay-domain/send
EMAIL_API_TOKEN=<RELAY_TOKEN>
EMAIL_FROM=no-reply@your-domain.com
```

> 不配置邮件变量时，询盘仍可正常入库，仅不发邮件通知；密码找回也会无法发送重置链接。

---

## 七、上线后必须操作

1. 访问后台入口（默认 `/admin/`），用 `admin / Admin@12345` 登录
2. **立即修改 admin 密码**（后台 → 管理员与权限）
3. 后台 → **站点设置**：填写站点名称、询盘收件邮箱、备案号、主色、开发者信息等
4. 后台 → **轮播图 / 首页内容 / 产品 / 文章**：替换演示数据
5. 为每个管理员填写真实邮箱，以便密码找回邮件能送达

---

## 八、故障排查

| 现象 | 排查 |
|---|---|
| 部署报 `database_id` 错误 | 检查 `DATABASE_ID` 环境变量是否已设置 |
| 部署报 `R2 bucket 'xxx' not found` | R2 桶未创建，或 `R2_BUCKET_NAME` 填错 |
| 部署成功但打开 500 | D1 未初始化，或占位符未替换；重新触发部署 |
| 图片上传失败 | R2 桶未创建，或桶名不一致 |
| 询盘不发邮件 | `EMAIL_API_URL/TOKEN` 未配置 |
| 后台登录即跳回 | 线上必须使用 https；Cookie 未被拦截 |
| 其它运行时报错 | Cloudflare 控制台 → Worker → **「日志」** 查看 |

---

## 九、本地开发

```bash
npm install
cp .dev.vars.example .dev.vars   # 按需填写本地变量
npm run db:local                 # 重置本地 D1
npm run dev                      # http://localhost:8787
```
