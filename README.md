# Earn Compass

Earn Compass 是一个用于管理 CeFi / DeFi 收益型投资仓位的 Next.js 全栈应用。它帮助用户记录投资本金、APR、收益、到期时间和仓位状态，并通过 Dashboard、Analytics 和每日快照追踪组合表现。

当前代码中的实际产品形态是：

- 未登录用户进入只读预览模式，浏览内置示例投资和示例分析数据
- 登录用户通过远程 API 管理自己的真实投资记录
- 支持邮箱密码注册登录，以及 Google / GitHub OAuth
- 支持 Dashboard、Analytics、Settings、Login、Register 页面
- 支持 PostgreSQL 数据持久化、组合快照、自动结算到期投资、到期提醒邮件和 Cloudflare Cron
- 代码中仍保留 Dexie / IndexedDB 本地仓库和 `storageMode` 抽象，但成熟主路径是登录后的远程数据模式

## 功能概览

- 投资记录管理：新增、编辑、删除、提前结束
- 收益总览：活跃本金、累计收益、日/周/月/年收益、加权 APR
- 分析图表：收入概览、真实快照趋势、收益趋势、APR 分布、项目占比、组合波动
- 快照系统：手动捕获当前用户快照；Cron 每 12 小时为远程用户捕获快照
- 到期处理：Cron 自动把已到期 `ONGOING` 投资更新为 `ENDED`
- 邮件提醒：Cron 每天 10:00 和 22:00（UTC+8）向有活跃投资的活跃用户发送到期提醒，24 小时内到期项目优先展示
- 设置中心：个人资料、时区、语言、显示币种、通知开关占位、JSON 导出、清空数据

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript + JavaScript 混合
- Tailwind CSS 4
- Radix UI / 本地 UI primitive wrappers
- 少量 Ant Design 依赖和遗留工作台组件
- Zustand
- react-hook-form / zod
- Recharts
- PostgreSQL
- `pg` + 参数化 SQL repository
- Dexie / IndexedDB 本地仓库
- 自定义 session cookie + OAuth
- Resend 邮件发送
- OpenNext for Cloudflare
- Cloudflare Workers + Cloudflare Cron

## 本地开发

### 1. 安装依赖

本仓库以 npm 为主，因为存在 `package-lock.json`。

```bash
npm install
```

### 2. 配置环境变量

创建 `.env`。本地开发如果只看预览模式可以不连数据库；一旦登录、注册、访问远程 API 或执行构建期需要数据库的代码，就需要至少配置：

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="replace-with-a-long-random-string"
ASSET_CREDENTIAL_ENCRYPTION_KEY="base64:replace-with-openssl-rand-base64-32"
CRON_SECRET="replace-with-a-long-random-string"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY="..."
RESEND_FROM_EMAIL="CeFiDeFi <alerts@yourdomain.com>"
```

如需启用 OAuth，再补充：

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
```

`ASSET_CREDENTIAL_ENCRYPTION_KEY` 用于加密保存 CEX API Key、API Secret 和 Passphrase。建议生成 32 字节随机主密钥：

```bash
openssl rand -base64 32
```

把输出保存为 `base64:<output>`。这个值只放在本地 `.env` 或 Cloudflare Secret，不要提交到仓库。

### 3. 初始化数据库

首次使用新的 PostgreSQL 数据库时，对目标数据库执行 [db/schema.sql](/Users/baiwei/Desktop/berry/earn/cefidefi/db/schema.sql:1)。

注意：不要对生产数据库运行未确认的 schema 或数据命令。

### 4. 启动开发环境

```bash
npm run dev
```

默认访问：

- [http://localhost:3000](http://localhost:3000)

## 常用脚本

```bash
npm run dev
npm run next:build
npm run build
npm run preview
npm run deploy
npm run cf-typegen
npm run start
```

说明：

- `npm run dev` 使用 `next dev --webpack`
- `npm run next:build` 执行普通 Next.js 生产构建
- `npm run build` 执行 OpenNext for Cloudflare 构建，输出 `.open-next/worker.js` 和 `.open-next/assets`
- `npm run preview` 先构建再启动 Cloudflare 本地预览
- `npm run deploy` 先构建再执行 `wrangler deploy`
- 当前没有配置独立的 test 或 lint 脚本

## 项目结构

```text
app/                     Next.js 页面、布局与 API routes
app/api/                 Auth、Investments、Analytics、Cron、Exchange Rate API
components/              页面组件与共享 UI
components/dashboard/    Dashboard 表格、筛选、表单、统计卡片
components/analytics/    Analytics 图表与摘要组件
components/layout/       导航与布局组件
components/ui/           本地 UI primitive wrappers
hooks/                   客户端 hooks
lib/                     鉴权、用户、投资、计算、快照、邮件、i18n、存储
lib/storage/             Dexie 客户端与本地/远程 repository 抽象
db/                      PostgreSQL schema
store/                   全局 app store
figma/                   Figma 和设计参考产物
public/                  静态资源
wrangler.jsonc           Cloudflare Workers、assets、Cron、observability 配置
custom-worker.js         OpenNext Worker 入口与 scheduled handler
```

路径别名：

- `@/*` 指向仓库根目录

## 关键实现说明

- 鉴权不使用 NextAuth；当前实现位于 [lib/auth.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/auth.ts:1)
- session cookie 名称为 `earn_compass_session`，HMAC-SHA256 签名，有效期 30 天
- 登录注册和 OAuth 用户创建会写入 PostgreSQL，默认 `storage_mode = 'REMOTE'`
- 远程数据 API 通过 `requireSession()` 保护，并按 `session.userId` 过滤用户数据
- PostgreSQL schema 位于 [db/schema.sql](/Users/baiwei/Desktop/berry/earn/cefidefi/db/schema.sql:1)
- 数据库访问使用 `pg` 连接池和参数化 SQL，未使用 Prisma runtime
- 未登录态使用 [lib/preview-data.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/preview-data.ts:1) 中的只读示例数据
- 单条删除为软删除；设置页“清空全部数据”当前会硬删除当前用户全部投资记录
- 快照和到期提醒任务会写入 `scheduled_job_logs`

## API 概览

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `PATCH /api/auth/session`
- `GET /api/auth/providers`
- `GET /api/auth/oauth/:provider`
- `GET /api/auth/oauth/:provider/callback`
- `GET /api/investments`
- `POST /api/investments`
- `PATCH /api/investments/:id`
- `DELETE /api/investments/:id`
- `POST /api/investments/:id/finish`
- `DELETE /api/investments`
- `GET /api/analytics/snapshots`
- `POST /api/analytics/snapshots`
- `GET /api/exchange-rate`
- `GET /api/cron/snapshots`
- `GET /api/cron/investments/settle`
- `GET /api/cron/investments/expiry-reminders`

## 部署

项目当前默认部署到 Cloudflare Workers，通过 OpenNext for Cloudflare 运行 Next.js SSR/API。详细部署步骤见 [DEPLOY.md](/Users/baiwei/Desktop/berry/earn/cefidefi/DEPLOY.md:1)。

生产环境必须配置：

- `DATABASE_URL`
- `AUTH_SECRET`
- `ASSET_CREDENTIAL_ENCRYPTION_KEY`
- `CRON_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

按需配置：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Cloudflare Cron 当前配置：

- `0 */12 * * *`：转发到 `/api/cron/snapshots`，每 12 小时采集收益/组合快照
- `0 2 * * *`：转发到 `/api/cron/investments/expiry-reminders`，对应 UTC+8 每天 10:00
- `0 14 * * *`：转发到 `/api/cron/investments/expiry-reminders`，对应 UTC+8 每天 22:00

Cron 时间按 UTC 解释。`Asia/Shanghai` / UTC+8 下，快照采集为每天 08:00 和 20:00，到期提醒为每天 10:00 和 22:00。

## 文档

- [prd.md](/Users/baiwei/Desktop/berry/earn/cefidefi/prd.md:1)
- [tech.md](/Users/baiwei/Desktop/berry/earn/cefidefi/tech.md:1)
- [DEPLOY.md](/Users/baiwei/Desktop/berry/earn/cefidefi/DEPLOY.md:1)
