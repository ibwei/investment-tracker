# Earn Compass 技术文档

## 1. 文档目的

本文档基于当前仓库代码，描述 Earn Compass 的最新技术实现、系统结构、数据库、API、Cron、邮件和 Cloudflare Workers 部署方式。它用于替代旧版技术方案中关于 SQLite、NextAuth、Vercel 优先部署、TradingView 或完整 Local/Remote 双模式产品的过时描述。

## 2. 技术概览

Earn Compass 当前是一个 Next.js 全栈应用，前端页面、服务端 API、鉴权逻辑、数据库访问、快照任务和邮件提醒都在同一仓库中维护。

### 2.1 当前技术栈

- 框架：Next.js 16 App Router
- 前端：React 19
- 语言：TypeScript + JavaScript 混合，当前核心代码以 `.ts/.tsx` 为主
- 样式：Tailwind CSS 4
- UI：本地 UI primitive wrappers、Radix UI、少量 Ant Design 依赖和遗留工作台组件
- 状态管理：Zustand
- 表单与校验：react-hook-form + zod
- 图表：Recharts
- 数据库：PostgreSQL
- 数据库访问：`pg` 连接池 + 参数化 SQL repository
- 本地存储：Dexie / IndexedDB
- 鉴权：自定义 session cookie + Google/GitHub OAuth
- 邮件：Resend
- 部署目标：Cloudflare Workers
- Next.js Workers 适配：OpenNext for Cloudflare
- 定时任务：Cloudflare Cron + Worker `scheduled()` handler
- 运行兼容：`nodejs_compat`

### 2.2 当前代码基线

- 包管理器：npm
- 普通开发：`npm run dev`
- Cloudflare 构建：`npm run build`
- Cloudflare 预览：`npm run preview`
- Cloudflare 部署：`npm run deploy`
- 当前没有独立 test/lint 脚本

## 3. 系统架构

### 3.1 分层

项目可以按以下层次理解：

1. 页面/API 层：`app/*`、`app/api/*`
2. 组件层：`components/*`
3. 客户端状态层：`lib/store.ts`、`store/app-store.ts`
4. 领域服务层：`lib/investments.ts`、`lib/snapshot.ts`、`lib/snapshot-history.ts`、`lib/users.ts`
5. 基础设施层：`lib/db.ts`、`lib/auth.ts`、`lib/oauth.ts`、`lib/email.ts`
6. 存储抽象层：`lib/storage/repositories/*`、`lib/storage/dexie/*`

### 3.2 数据模式

当前成熟产品路径是：

- 未登录用户：预览模式，使用 `previewInvestments` 和 `previewSnapshots`，只读
- 登录用户：远程模式，通过 API 读写 PostgreSQL 中属于自己的数据

仍然存在但不是主产品路径的能力：

- `storageMode` 抽象
- Dexie / IndexedDB 本地 repository
- 部分 Ant Design 工作台组件，如 `components/dashboard-workspace.tsx`、`components/analysis-workspace.tsx`、`components/settings-workspace.tsx`

当前主路由入口使用的是 `app/page.tsx`、`app/analytics/page.tsx`、`app/settings/page.tsx` 对应的 Tailwind/Radix UI 体验。

## 4. 前端结构

### 4.1 路由

- `/`：Dashboard，投资看板和投资列表
- `/analytics`：Analytics，组合收益和快照分析
- `/settings`：Settings，账户资料、偏好、导出和清空数据
- `/login`：登录
- `/register`：注册

### 4.2 主要组件

- `components/layout/navbar.tsx`
  - 顶部导航、登录态展示、语言切换、移动端菜单
- `components/auth-provider.tsx`
  - 客户端登录态上下文
- `components/dashboard/*`
  - 统计卡片、筛选器、投资表格、投资表单
- `components/analytics/*`
  - 收入概览、真实快照趋势、收益趋势、APR 分布、项目拆分、组合波动
- `components/ui/*`
  - 基础 UI primitive wrappers

### 4.3 国际化、币种和时区

`lib/i18n.tsx` 提供中英文文案、显示币种偏好和汇率换算辅助。显示币种偏好存储在浏览器 localStorage。

当前支持语言：

- `en`
- `zh`

当前支持显示币种：

- `USD`
- `CNY`
- `EUR`
- `GBP`
- `JPY`
- `HKD`
- `SGD`
- `AUD`
- `CAD`
- `CHF`
- `KRW`
- `AED`

`lib/time.ts` 提供应用时区解析、输入时间转 UTC、按应用时区生成日期 key 等工具。默认时区是 `Asia/Shanghai`。

## 5. 状态与数据流

### 5.1 登录态

服务端在 `app/layout.tsx` 中读取 session，并把用户注入 `AuthProvider`。客户端通过 `useAuth()` 获取：

- `user`
- `isAuthenticated`
- `isLoading`

`AuthProvider` 同时设置本地 `userScope`，用于 Dexie 数据隔离：

- 登录用户：`user:{id}`
- 游客：`guest`

### 5.2 投资状态仓库

`lib/store.ts` 是当前主页面使用的投资状态仓库，负责：

- 初始化预览数据或远程数据
- 新增、编辑、删除、结束投资
- 清空数据
- 筛选和排序
- 将 API snapshot 映射为前端 `Investment` 类型

初始化流程：

1. 页面根据 `isAuthenticated` 调用 `initialize({ preview: !isAuthenticated })`
2. 未登录时加载 `previewInvestments`
3. 已登录时通过 `getInvestmentRepository(storageMode)` 获取 repository
4. 默认 `storageMode` 为 `REMOTE`
5. 远程 repository 调用 `/api/investments`
6. store 将后端 dashboard snapshot 映射成前端列表和图表数据

### 5.3 Repository 抽象

`lib/storage/repositories/index.ts` 根据 `storageMode` 返回：

- `remoteInvestmentRepository`
- `localInvestmentRepository`

远程 repository 通过 HTTP API 操作 PostgreSQL。

本地 repository 使用 Dexie，并按 `local-user-scope` 隔离数据。

## 6. 数据库与持久化

### 6.1 PostgreSQL

正式数据源是 PostgreSQL。schema 位于 [db/schema.sql](/Users/baiwei/Desktop/berry/earn/cefidefi/db/schema.sql:1)。

数据库访问位于 [lib/db.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/db.ts:1)，实现要点：

- 使用 `pg.Pool`
- 连接字符串来自 `DATABASE_URL`
- 非本地数据库默认启用 SSL，`sslmode=disable` 可显式关闭
- 连接池上限 `max: 5`
- 提供 `query`、`queryOne`、`execute`、`withTransaction`
- 所有业务 SQL 使用参数化查询

### 6.2 核心表

- `users`
  - 用户邮箱、密码 hash、姓名、角色、状态、存储模式、时区
- `auth_accounts`
  - OAuth provider 账号映射
- `investments`
  - 投资主记录
- `investment_daily_snapshots`
  - 单笔投资每日快照
- `portfolio_daily_snapshots`
  - 用户组合每日快照
- `operation_logs`
  - 操作日志预留表
- `scheduled_job_logs`
  - 定时任务执行日志

### 6.3 用户状态和存储模式

`users.storage_mode` schema 默认值是 `LOCAL`，但当前注册和 OAuth 创建用户时写入的是 `REMOTE`。Cron 快照任务只处理 `storage_mode = 'REMOTE'` 的用户。

`users.status` 当前注册和 OAuth 用户为 `ACTIVE`。到期提醒邮件只发送给 `users.status = 'ACTIVE'` 且存在 `ONGOING` 投资的用户。

### 6.4 Dexie / IndexedDB

本地库定义于 [lib/storage/dexie/client.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/storage/dexie/client.ts:1)：

- 数据库名：`cefidefi-local`
- 表：`investments`、`settings`

本地仓库当前主要作为存储抽象和后续扩展保留，不是登录用户的默认生产路径。

## 7. 鉴权与账户

### 7.1 Session

项目不使用 NextAuth。当前鉴权由 [lib/auth.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/auth.ts:1) 实现：

- session cookie 名称：`earn_compass_session`
- session payload：`userId`、`email`、`exp`
- 签名：HMAC-SHA256
- 有效期：30 天
- cookie：`httpOnly`、`sameSite=lax`、生产环境 `secure`
- 密码哈希：Node `scrypt`

生产环境必须配置强 `AUTH_SECRET`。本地开发没有配置时会使用开发 fallback，但生产不可依赖 fallback。

### 7.2 邮箱密码账户

[lib/users.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/users.ts:1) 提供：

- 注册
- 登录
- 用户资料更新
- 用户时区读取
- OAuth 用户查找、绑定和创建

注册规则：

- email 必填且唯一
- password 最少 8 位
- 新用户状态为 `ACTIVE`
- 新用户存储模式为 `REMOTE`
- 默认时区为 `Asia/Shanghai`

### 7.3 OAuth

[lib/oauth.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/oauth.ts:1) 支持：

- Google
- GitHub

OAuth 实现要点：

- `/api/auth/providers` 返回 provider 可用性
- OAuth state 存在 provider 独立 cookie 中
- callback 通过 code exchange 获取 profile
- 先按 provider account 查找用户
- 若 provider account 不存在，则按 email 绑定已有用户或创建新用户

## 8. 投资业务模型

### 8.1 Investment 字段

核心字段来自 `investments` 表：

- `project`
- `asset_name`
- `url`
- `type`
- `amount`
- `currency`
- `allocation_note`
- `apr_expected`
- `apr_actual`
- `income_total`
- `income_daily`
- `income_weekly`
- `income_monthly`
- `income_yearly`
- `start_time`
- `end_time`
- `holding_days`
- `status`
- `remark`
- `is_deleted`
- `deleted_at`

### 8.2 投资类型

定义在 [lib/calculations.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/calculations.ts:1)：

- `Interest`
- `LP`
- `Lending`
- `CeDeFi`

前端会映射为：

- `interest`
- `lp`
- `lending`
- `cedefi`

### 8.3 投资状态

数据库状态：

- `ONGOING`
- `ENDED`
- `EARLY_ENDED`

前端状态：

- `active`
- `ended`
- `early_ended`
- `deleted`

### 8.4 收益计算规则

主要计算逻辑在 [lib/calculations.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/calculations.ts:1) 和 [lib/snapshot.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/snapshot.ts:1)。

关键规则：

- 持有天数最少按 1 天计算
- 活跃投资优先使用预期 APR 推导收益
- 已结束投资优先使用手动录入的实际 APR 或最终总收益
- 如果最终总收益存在，可以基于本金和持有天数反推实际 APR
- Dashboard summary 聚合活跃本金、累计收益、日/周/月/年收益、加权 APR

## 9. API 设计

所有用户数据 API 必须通过 `requireSession()` 获取 `session.userId`，并按当前用户过滤数据。

### 9.1 Auth API

- `POST /api/auth/register`
  - 创建用户，设置 session cookie
- `POST /api/auth/login`
  - 校验邮箱密码，设置 session cookie
- `POST /api/auth/logout`
  - 清除 session cookie
- `GET /api/auth/session`
  - 返回当前用户
- `PATCH /api/auth/session`
  - 更新当前用户姓名、邮箱、时区
- `GET /api/auth/providers`
  - 返回 Google/GitHub provider 是否已配置
- `GET /api/auth/oauth/:provider`
  - 发起 OAuth
- `GET /api/auth/oauth/:provider/callback`
  - OAuth 回调

### 9.2 Investment API

- `GET /api/investments`
  - 获取当前用户 dashboard snapshot
- `POST /api/investments`
  - 创建投资并返回最新 snapshot
- `PATCH /api/investments/:id`
  - 更新当前用户的指定投资并返回最新 snapshot
- `DELETE /api/investments/:id`
  - 软删除当前用户的指定投资，body 需要 `confirmationText = "DELETE"`
- `POST /api/investments/:id/finish`
  - 结束或提前结束投资并返回最新 snapshot
- `DELETE /api/investments`
  - 清空当前用户全部投资，当前实现为硬删除

### 9.3 Analytics API

- `GET /api/analytics/snapshots`
  - 查询当前用户组合快照历史
  - 支持 `days` 或 `startDate`
- `POST /api/analytics/snapshots`
  - 手动生成当前用户今日快照

### 9.4 Utility API

- `GET /api/exchange-rate`
  - 查询 USD 到目标显示币种的汇率
  - 当前上游为 Frankfurter

### 9.5 Cron API

Cron API 使用 `CRON_SECRET` 鉴权，支持：

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

路由：

- `GET /api/cron/snapshots`
  - 先自动结算到期投资，再为所有 `REMOTE` 用户捕获收益/组合快照
  - 写入 `scheduled_job_logs`，jobName 为 `portfolio-snapshot-capture`
- `GET /api/cron/investments/settle`
  - 独立执行到期投资自动结算
  - 写入 `scheduled_job_logs`，jobName 为 `investment-auto-settle`
- `GET /api/cron/investments/expiry-reminders`
  - 向有活跃投资的活跃用户发送到期提醒邮件
  - 写入 `scheduled_job_logs`，jobName 为 `investment-expiry-reminders`

## 10. 快照与定时任务

### 10.1 快照策略

[lib/snapshot-history.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/snapshot-history.ts:1) 负责：

1. 读取用户未删除投资记录
2. 按用户时区生成 `snapshot_date`
3. 归一化每条投资的收益指标
4. upsert `investment_daily_snapshots`
5. 聚合并 upsert `portfolio_daily_snapshots`

`captureSnapshotsForRemoteUsers()` 只处理 `storage_mode = 'REMOTE'` 的用户。

### 10.2 自动结算

`autoSettleMaturedInvestments()` 会查找：

- `is_deleted = false`
- `status = 'ONGOING'`
- `end_time is not null`
- `end_time <= referenceDate`

匹配记录会被批量更新为 `ENDED`。

### 10.3 到期提醒邮件

[lib/investment-expiry-reminders.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/investment-expiry-reminders.ts:1) 负责：

- 查询所有活跃用户的 `ONGOING` 投资
- 按用户分组
- 统计未来 24 小时内到期投资
- 构建 HTML 和 text 邮件
- 通过 [lib/email.ts](/Users/baiwei/Desktop/berry/earn/cefidefi/lib/email.ts:1) 调用 Resend

当前行为是：只要用户存在活跃投资，每天 10:00 和 22:00（UTC+8）都会收到摘要邮件；未来 24 小时内到期的项目在邮件中优先展示。

## 11. Cloudflare Workers 部署

### 11.1 构建与入口

部署目标是 Cloudflare Workers。OpenNext for Cloudflare 构建产物由 `custom-worker.js` 引入：

- `npm run build` 生成 `.open-next/worker.js` 和 `.open-next/assets`
- `wrangler.jsonc` 的 `main` 指向 `./custom-worker.js`
- `custom-worker.js` 的 `fetch` 直接委托给 OpenNext Worker
- `custom-worker.js` 的 `scheduled()` 根据 cron 表达式转发到内部 API

### 11.2 Wrangler 配置

[wrangler.jsonc](/Users/baiwei/Desktop/berry/earn/cefidefi/wrangler.jsonc:1) 当前要点：

- Worker 名称：`investment-tracker`
- `compatibility_date`: `2026-04-12`
- `compatibility_flags`: `["nodejs_compat"]`
- assets directory：`.open-next/assets`
- `keep_vars: true`
- Cron：
  - `0 */12 * * *`
  - `0 2 * * *`
  - `0 14 * * *`
- logs observability 开启，traces 未开启

`keep_vars: true` 表示 Cloudflare Dashboard 中配置的 runtime vars 会在 deploy 时保留。Secrets 仍应通过 Cloudflare Secrets 管理，不应写入仓库。

### 11.3 Cron 映射

[custom-worker.js](/Users/baiwei/Desktop/berry/earn/cefidefi/custom-worker.js:1) 当前映射：

- `0 */12 * * *` -> `/api/cron/snapshots`
- `0 2 * * *` -> `/api/cron/investments/expiry-reminders`
- `0 14 * * *` -> `/api/cron/investments/expiry-reminders`

Cloudflare Cron 使用 UTC：

- `0 */12 * * *` = 每天 `08:00` 和 `20:00 Asia/Shanghai`
- `02:00 UTC` = `10:00 Asia/Shanghai`
- `14:00 UTC` = `22:00 Asia/Shanghai`

`/api/cron/investments/settle` 是可手动调用的独立结算 route，当前没有单独配置 Cloudflare Cron，因为 `/api/cron/snapshots` 已经会先执行自动结算。

### 11.4 环境变量

生产必需：

- `DATABASE_URL`
- `AUTH_SECRET`
- `CRON_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

OAuth 可选：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

### 11.5 数据库连接要求

当前部署方案不要求数据库必须在 Cloudflare 上。可以继续使用现有 PostgreSQL URL，前提是：

- 数据库允许 Cloudflare Workers 外部连接
- `DATABASE_URL` 在 Worker runtime 可用
- SSL 配置与数据库服务匹配
- 连接数限制能接受 Workers 场景下的短连接/池化行为

## 12. 当前代码与旧方案差异

- 数据库不是 SQLite，而是 PostgreSQL
- 鉴权不是 NextAuth，而是自定义 session cookie + OAuth
- 部署基线不是 Vercel，而是 Cloudflare Workers + OpenNext
- 图表不是 TradingView，而是 Recharts
- UI 主路径不是 Ant Design-first，而是 Tailwind/Radix/本地 UI primitives；Ant Design 组件仍作为依赖和遗留工作台存在
- 当前成熟路径是“游客预览 + 登录后远程数据”，不是完整成熟的前台 Local/Remote 双模式产品
- Prisma 不在运行时使用，数据库访问是 `pg` + 参数化 SQL
- Cron 已经落地，包括快照、自动结算和到期提醒邮件

## 13. 后续技术建议

- 为 `lib/calculations.ts`、`lib/snapshot.ts`、`lib/investments.ts` 增加单元测试
- 为 Auth、Investment、Analytics、Cron API 增加集成测试
- 明确 `DELETE /api/investments` 的硬删除语义是否符合产品预期
- 如果继续保留 Local Mode，补齐其完整 UI、Analytics 和同步策略；否则减少暴露面
- 将遗留 Ant Design 工作台组件归档或迁移到当前主 UI 体系
- 补充生产级日志、告警和邮件发送失败重试策略
- 为到期提醒增加用户级通知偏好持久化，避免每天固定发送给所有活跃投资用户
