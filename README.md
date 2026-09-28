# 晚叙 CMS v1.0.0 — 外贸企业官网与内容管理系统

基于 Cloudflare Workers 的全栈 CMS：**Hono + D1 + R2 + Assets**，中英双语，前后台一体部署，零服务器运维。

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 运行时 | [Cloudflare Workers](https://workers.cloudflare.com/) | 无服务器边缘计算平台，全球就近响应 |
| Web 框架 | [Hono](https://hono.dev/) | 轻量、快速、支持 JSX 服务端渲染 |
| 模板 / SSR | Hono JSX + 原生 HTML/CSS/JS | 服务端直接渲染完整页面，利于 SEO |
| 数据库 | [Cloudflare D1](https://developers.cloudflare.com/d1/) | SQLite 边缘数据库，存储站点内容、用户、询盘 |
| 对象存储 | [Cloudflare R2](https://developers.cloudflare.com/r2/) | 图片 / 媒体文件存储，兼容 S3 API |
| 静态资源 | [Workers Assets](https://developers.cloudflare.com/workers/static-assets/) | 前台 CSS/JS/Favicon + 后台 SPA 静态托管 |
| 身份认证 | Cookie + PBKDF2-SHA256 | 服务端会话，密码 10 万次迭代哈希 |
| 富文本 | Markdown / HTML 双模式编辑器 | 后台在线编辑，支持图片上传 |
| 部署工具 | [Wrangler](https://developers.cloudflare.com/workers/wrangler/) + GitHub Actions | 一条 `git push` 自动类型检查、建桶、初始化数据库、部署 |

## 功能总览

**前台（`/en` `/zh` 双语）**

- 全新视觉（深墨绿 + 暖金 + 衬线标题）
- **智能地区语言识别**：访问 `/` 时，中国 IP 自动跳 `/zh`，其它国家/地区自动跳 `/en`；用户手动切换语言后会记住偏好，不影响刷新/重新进入
- 首页版块化：Hero 轮播 / 品牌故事 / 特色产品 / 关于摘要 / 询盘召唤，**版块与顺序后台可配**
- 顶部导航后台可增删改，页脚自动同步
- 产品中心 + 详情页：多图画廊、规格、**外贸参数规格表**（材质 / MOQ / 交期 / 贸易条款…）
- 新闻文章、关于我、合作伙伴、联系询盘页；全站 SEO（canonical / hreflang / sitemap）
- 支持**中文版站点名称 + 中文版 Logo** 独立设置，中英站点可分别展示不同品牌名与 Logo

**管理后台（`/admin/`，路径可自定义）**

- 管理员等级（RBAC）：超级管理员 / 管理员 / 编辑，接口层强制校验
- 导航管理、站点设置（站点信息 + 开发者信息 + 首页版块排序）、管理员管理
- 轮播图、首页内容、产品分类、产品（含外贸参数编辑器）、文章、询盘管理
- **Markdown / HTML 双模式富文本编辑器**，支持插入图片（上传至 R2）与实时预览
- 询盘双通道：站内表单入库 + **邮件通知转发**（环境变量配置，后台可查通知状态）

## 快速开始（本地开发）

```bash
npm install
npm run db:local     # 初始化本地 D1（schema + 种子数据）
npm run dev          # http://localhost:8787
```

- 后台入口：`/admin/`（默认）
- 默认账号：`admin` / `Admin@12345`

## 通过 GitHub 部署到 Cloudflare Workers

本仓库已过滤 `node_modules/`、`.wrangler/`、`.dev.vars` 等无需上传的文件，可直接推送到 GitHub 并关联 Cloudflare 自动部署。完整环境变量 / 邮件通知 / 自定义域名 / 故障排查说明见 **[docs/DEPLOY.md](docs/DEPLOY.md)**。

### 1. 初始化 GitHub 仓库并推送

```bash
cd 晚叙CMS1.1

git init
git add .
git commit -m "init(wanxu-cms): v1.0.0 ready for cloudflare deploy"

# 方式 A：使用 GitHub CLI
git branch -M main
gh repo create wanxu-cms --public --source=. --remote=origin --push

# 方式 B：在 GitHub 网页新建空仓库后手动关联
# git remote add origin https://github.com/<你的用户名>/wanxu-cms.git
# git branch -M main
# git push -u origin main
```

### 2. 创建 Cloudflare 云端资源

部署前必须先创建 **D1 数据库** 和 **R2 存储桶**。

#### 2.1 创建 D1 数据库

**方式 A：命令行**

```bash
npx wrangler login
npx wrangler d1 create wanxu_cms
```

成功后会输出 `database_id`，复制备用。

**方式 B：Cloudflare 控制台**

1. 打开 https://dash.cloudflare.com
2. 左侧主导航 → **「Workers 和 Pages」** → **「D1 数据库」**
3. 点击 **「创建数据库」**（Create database）
4. 名称填 `wanxu_cms`，点击 **「创建」**
5. 进入数据库详情页，复制页面上的 **UUID**（形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`），这就是 `database_id`

#### 2.2 创建 R2 存储桶

**方式 A：命令行**

```bash
npx wrangler r2 bucket create wanxu-cms-media
```

**方式 B：Cloudflare 控制台**

1. 打开 https://dash.cloudflare.com
2. 左侧主导航 → **「R2」**（R2 Object Storage）
3. 点击 **「创建存储桶」**（Create bucket）
4. 桶名填 `wanxu-cms-media`，点击 **「创建」**

> ⚠️ R2 存储桶名称在 Cloudflare 全平台**全局唯一**。如果提示名字已被占用，请换一个唯一名字（例如 `wanxu-cms-media-你的用户名`），并同步修改环境变量 `R2_BUCKET_NAME`。

> ⚠️ **安全提示**：`wrangler.toml` 里只有占位符，**不要把真实值填进去再提交**。

#### 2.3 配置环境变量

`wrangler.toml` 使用占位符，部署时由 CI/CD 自动替换：

```toml
[[d1_databases]]
database_id = "__DATABASE_ID__"

[[r2_buckets]]
bucket_name = "__R2_BUCKET_NAME__"

[vars]
SITE_URL = "__SITE_URL__"
```

**需要设置的环境变量**：

| 环境变量 | 值 | 说明 |
|---|---|---|
| `DATABASE_ID` | 2.1 中复制的 D1 UUID | D1 数据库真实 ID |
| `R2_BUCKET_NAME` | 2.2 中创建的 R2 桶名 | 例如 `wanxu-cms-media` |
| `SITE_URL` | 你的正式域名 | 例如 `https://www.yoursite.com` |
| `ADMIN_PATH` | 后台访问入口路径（可选） | 默认 `/admin`；可改为 `/manage`、`/console` 等 |
| `ADMIN_PASSWORD` | admin 初始密码（可选） | 默认 `Admin@12345`；建议首次部署时改成强密码 |
| `GEO_REDIRECT` | 是否按地区自动跳转语言（可选） | 默认 `true`；不需要可填 `false` |
| `DEV_CHALLENGE_SECRET` | 随机字符串（可选但**强烈建议设置**） | 开发者验证 Cookie 签名密钥，生产环境必须修改 |
| `DEV_CHALLENGE_ANSWER` | 自定义答案（可选但**强烈建议设置**） | 修改开发者联系方式时的验证答案 |

配置位置：

- **方式 A（Cloudflare Workers Builds）**：Cloudflare 控制台 → 该 Worker → **「构建设置」** → **「环境变量」**
- **方式 B（GitHub Actions）**：GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 3. 选择部署方式（二选一）

#### 方式 A：Cloudflare Workers Builds（官方 Git 直连）

Cloudflare 官方「Git 自动部署」。代码 push 到 GitHub，`main` 分支自动部署。

1. 打开 https://dash.cloudflare.com
2. 左侧主导航 → **「Workers 和 Pages」** → 右上角 **「创建应用程序」**（Create application）
3. 选择 **「通过 Git 连接」** / **「Connect to Git」**
4. 授权 Cloudflare 访问你的 GitHub，选择 `wanxu-cms` 仓库，`main` 分支
5. 在 **「环境变量」** 添加 `DATABASE_ID`、`R2_BUCKET_NAME`、`SITE_URL` 等变量
6. 填写：
   - **构建命令**：`node scripts/replace-wrangler-placeholders.mjs && npm run build`
   - **部署命令**：`node scripts/init-remote-db.mjs && npm run deploy`
7. 点击 **「保存并部署」**
8. 等待 30 秒 ~ 1 分钟，部署成功后页面会显示 `https://wanxu-cms.<你的子域>.workers.dev`

> 首次部署会自动执行 `schema.sql` 建表 + `seed.sql` 写入默认数据；后续部署只同步 `schema.sql`，不会清空数据。

#### 方式 B：GitHub Actions + Wrangler

本仓库已包含 `.github/workflows/deploy.yml`。每次 `git push` 到 `main`，GitHub Actions 自动执行：

1. `npm ci` 安装依赖
2. 读取 Secrets 替换 `wrangler.toml` 占位符
3. `npm run build` 类型检查
4. 自动创建 R2 存储桶（已存在则忽略）
5. 自动初始化/同步 D1 数据库
6. `wrangler deploy` 部署 Worker + 静态资源

需配置的 Secrets：

| Secret 名称 | 必填 | 说明 |
|---|---|---|
| `DATABASE_ID` | 是 | D1 数据库 UUID |
| `R2_BUCKET_NAME` | 是 | R2 存储桶名称 |
| `SITE_URL` | 是 | 正式域名 |
| `CLOUDFLARE_API_TOKEN` | 是 | 权限：Workers 编辑、D1 编辑、R2 编辑、账号读取 |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Cloudflare Account ID |
| `ADMIN_PATH` | 否 | 后台入口路径，默认 `/admin` |
| `ADMIN_PASSWORD` | 否 | admin 初始密码，默认 `Admin@12345` |
| `GEO_REDIRECT` | 否 | 默认 `true` |

### 4. 获取访问地址并绑定自定义域名

#### 4.1 workers.dev 地址

部署成功后 Cloudflare 会自动分配：

```
https://wanxu-cms.<你的子域>.workers.dev
```

#### 4.2 绑定自定义域名

1. Cloudflare Dashboard → **Workers 和 Pages** → 点击 `wanxu-cms`
2. 顶部 **「设置」**（Settings）→ **「触发器」/「域和路由」**（Triggers / Domains & Routes）
3. 点击 **「添加自定义域」**（Add custom domain）
4. 输入域名，例如 `www.yoursite.com`
5. Cloudflare 自动添加 DNS 记录，1~2 分钟生效

> 域名必须已接入 Cloudflare DNS。

#### 4.3 更新 `SITE_URL`

绑定自定义域后，把环境变量 `SITE_URL` 改为 `https://www.yoursite.com` 并重新部署，SEO 相关的 canonical / sitemap / hreflang 会使用真实域名。

### 5. 首次上线必须操作

- 访问后台入口（默认 `/admin/`），用默认账号 `admin / Admin@12345` 登录
- **立即修改 admin 密码**（后台 → 管理员与权限）
- 后台 → **站点设置**：填写站点名称、询盘收件邮箱、备案号、主色、开发者信息等
- 后台 → **轮播图 / 首页内容 / 产品 / 文章**：替换演示数据
- （可选）后台 → **导航管理**：调整前台顶部导航与二级下拉菜单

## 环境变量

| 变量 | 位置 | 说明 |
|---|---|---|
| `SITE_URL` | GitHub Secrets / Cloudflare 环境变量 | 正式域名（SEO 用） |
| `DATABASE_ID` | GitHub Secrets / Cloudflare 环境变量 | D1 数据库 UUID |
| `R2_BUCKET_NAME` | GitHub Secrets / Cloudflare 环境变量 | R2 存储桶名称 |
| `EMAIL_API_URL` | secret / `.dev.vars` | 询盘邮件 Webhook（如 Resend） |
| `EMAIL_API_TOKEN` | secret / `.dev.vars` | 邮件服务 Bearer 令牌 |
| `EMAIL_FROM` | secret / `.dev.vars` | 发件人（缺省 no-reply@站点域名） |

本地示例见 `.dev.vars.example`。

## 目录结构

```
src/            Worker 源码（路由 / 页面 JSX / repo / 中间件）
public/         前台静态资源 + admin/ 后台 SPA
db/             D1 schema.sql + seed.sql
docs/           DEPLOY.md 部署教程
scripts/        部署辅助脚本（占位符替换、自动初始化远程 D1 等）
.github/        GitHub Actions 工作流
```

## 安全说明

- 密码 PBKDF2-SHA256 10 万次迭代哈希存储；会话为随机 hex 令牌（HttpOnly Cookie，7 天）
- 所有管理接口服务端二次校验 + RBAC 强制
- 登录、询盘接口带 D1 持久化 IP 速率限制（5 分钟 5 次登录 / 10 分钟 5 次询盘）
- 上传接口拒绝 SVG、校验图片文件真实魔数；非图片文件通过 `/media/*` 下载时强制 `Content-Disposition: attachment` 并附加 `X-Content-Type-Options: nosniff`
- 全站响应追加安全头：HSTS（HTTPS 下）、CSP、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`
- 开发者验证默认答案改为不可从公开信息推导的随机串；修改开发者信息接口仅限 `super_admin`
- `/api/site` 公开接口不再返回开发者邮箱、微信号
- 初始账号 `admin / Admin@12345` 仅供首次部署，上线后请立即更换；同时务必设置 `DEV_CHALLENGE_SECRET` 和 `DEV_CHALLENGE_ANSWER`

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改、分发，包括商业用途。
