# Earn Compass 技术文档

## 1. 文档目的

本文档基于当前仓库代码，描述 Earn Compass 的最新技术实现、系统结构、关键模块、部署方式与运行依赖，用于替代旧版 `techplan.md` 中已经失真的方案描述。

## 2. 技术概览

当前项目采用 Next.js 全栈架构，前端页面、服务端 API、鉴权逻辑、数据库访问和定时任务都在同一仓库中维护。

### 2.1 当前技术栈

- 框架：Next.js 16 App Router
- 前端：React 19
- 语言：TypeScript + JavaScript 混合
- 状态管理：Zustand
- 表单：react-hook-form + zod
- UI：自定义 UI 组件 + Radix UI + Tailwind CSS 4
- 图表：Recharts
- 数据库：PostgreSQL
- ORM：Prisma
- 本地存储：Dexie / IndexedDB
- 鉴权：自定义 session cookie + OAuth
- 部署目标：Cloudflare Workers（OpenNext for Cloudflare）
- 监控：暂未绑定平台监控 SDK，可后续接入 Cloudflare Web Analytics / Zaraz / 自有监控

## 3. 系统架构

### 3.1 架构分层

项目可以分为五层：

1. 页面层：`app/*`
2. 组件层：`components/*`
3. 状态与前端数据层：`lib/store.ts`、`store/app-store.js`
4. 领域与服务层：`lib/investments.js`、`lib/snapshot-history.js`、`lib/users.js`
5. 持久化层：Prisma + PostgreSQL，以及 Dexie 本地仓库

### 3.2 运行模式

当前实现并不是旧方案里“前台完全可切换的 Local / Remote 双模式产品”，而是更接近以下形态：

- 默认数据模式是 `REMOTE`
- 未登录用户进入预览模式，使用本地内置 mock 数据
- 登录用户通过远程 API 读写真实数据
- 代码中仍保留 Dexie 本地仓库能力和 `storageMode` 抽象，便于继续扩展

## 4. 前端结构

### 4.1 路由

- `/`：Dashboard，看板与投资列表
- `/analytics`：分析页
- `/settings`：设置页
- `/login`：登录页
- `/register`：注册页

### 4.2 核心组件

- `components/layout/navbar.tsx`
  - 顶部导航、登录态展示、移动端菜单
- `components/auth-provider.tsx`
  - 客户端登录态上下文
- `components/dashboard/*`
  - 统计卡片、筛选器、表格、表单
- `components/analytics/*`
  - 收益概览、趋势图、APR 分布、项目拆分、组合波动
- `components/ui/*`
  - 基础 UI 组件封装

### 4.3 国际化

`lib/i18n.tsx` 提供中英文文案与显示币种偏好管理。

当前支持：

- 语言：`en`、`zh`
- 显示币种：`USD`、`CNY`、`EUR`、`GBP`、`JPY`、`HKD`、`SGD`、`AUD`、`CAD`、`CHF`、`KRW`、`AED`

## 5. 状态与数据流

### 5.1 登录态

服务端在 `app/layout.js` 中通过 `getSession()` 读取 cookie，并注入 `AuthProvider`。客户端通过 `useAuth()` 获取当前用户与 `isAuthenticated` 状态。

`AuthProvider` 同时会设置本地 `userScope`，用于 Dexie 数据隔离：

- 登录用户：`user:{id}`
- 游客：`guest`

### 5.2 投资数据状态

`lib/store.ts` 是主投资状态仓库，负责：

- 初始化数据
- 预览模式切换
- 新增、编辑、删除、结束投资
- 筛选与排序
- 调用本地或远程 repository

数据流如下：

1. 页面初始化调用 `initialize`
2. 未登录时加载 `previewInvestments`
3. 登录后调用 repository 获取 snapshot
4. 表单操作通过 repository 写入后返回最新 snapshot
5. store 将 snapshot 映射为前端统一 Investment 类型

## 6. 数据访问层

### 6.1 Repository 抽象

`lib/storage/repositories/index.js` 根据 `storageMode` 返回：

- `remoteInvestmentRepository`
- `localInvestmentRepository`

### 6.2 Remote Repository

远程仓库通过 HTTP 调用：

- `GET /api/investments`
- `POST /api/investments`
- `PATCH /api/investments/:id`
- `DELETE /api/investments/:id`
- `POST /api/investments/:id/finish`
- `DELETE /api/investments`

### 6.3 Local Repository

本地仓库基于 Dexie，按 `userScope` 隔离数据。当前主要用于本地持久化抽象与后续扩展，不是当前默认主流程。

本地库定义于 `lib/storage/dexie/client.js`：

- 数据库名：`cefidefi-local`
- 表：`investments`、`settings`

## 7. 鉴权与账户系统

### 7.1 Session 机制

项目没有使用 NextAuth。

当前鉴权由 `lib/auth.js` 自行实现：

- 使用 `HMAC-SHA256` 签名 session payload
- cookie 名称：`earn_compass_session`
- session 默认有效期：30 天
- 密码哈希：`scrypt`

### 7.2 账户能力

`lib/users.js` 提供：

- 用户注册
- 邮箱密码登录
- 资料更新
- OAuth 登录用户绑定 / 创建

### 7.3 OAuth

`lib/oauth.js` 当前支持：

- Google
- GitHub

实现特征：

- 使用 provider code exchange 获取用户资料
- 通过 cookie 保存 OAuth state
- 根据 provider account 或 email 自动绑定 / 创建本地用户

## 8. 数据模型

### 8.1 数据源

Prisma schema 位于 [prisma/schema.prisma](/Users/baiwei/Desktop/berry/earn/cefidefi/prisma/schema.prisma:1)，当前 `datasource` 使用 `postgresql`。Cloudflare Workers 部署使用 `@prisma/adapter-pg` 连接 PostgreSQL，因此现有 PostgreSQL URL 可以继续使用，前提是数据库允许来自 Cloudflare Workers 的外部连接。

### 8.2 核心模型

- `User`
  - 用户基础信息、角色、状态、存储模式
- `AuthAccount`
  - OAuth 账号映射
- `Investment`
  - 投资主记录
- `InvestmentDailySnapshot`
  - 每个投资的日快照
- `PortfolioDailySnapshot`
  - 用户维度的组合日快照
- `OperationLog`
  - 预留的操作日志表
- `ScheduledJobLog`
  - 定时任务执行日志

## 9. 业务计算

### 9.1 计算模块

业务口径主要位于：

- `lib/calculations.js`
- `lib/snapshot.js`

### 9.2 关键规则

- 投资类型：`Interest`、`LP`、`Lending`、`CeDeFi`
- 投资状态：`ONGOING`、`ENDED`、`EARLY_ENDED`
- 持有天数至少按 1 天计算
- 活跃仓位优先用预期 APR 推导收益
- 已结束仓位优先使用手动录入的实际 APR 或最终收益
- 如果已结束且有 `incomeTotal`，会反推 `actualApr`

### 9.3 Dashboard Snapshot

`buildDashboardSnapshot()` 会输出：

- `records`
- `activeRecords`
- `historicalRecords`
- `summary`
- `meta`

`summary` 目前包含：

- 活跃仓位数
- 历史仓位数
- 活跃本金
- 总收益
- 活跃日 / 周 / 月 / 年收益
- 加权 APR

## 10. API 设计

### 10.1 Auth API

- `POST /api/auth/register`
  - 注册并设置 session
- `POST /api/auth/login`
  - 登录并设置 session
- `POST /api/auth/logout`
  - 清除 session
- `GET /api/auth/session`
  - 获取当前用户
- `PATCH /api/auth/session`
  - 更新当前用户资料
- `GET /api/auth/oauth/:provider`
  - 发起 OAuth
- `GET /api/auth/oauth/:provider/callback`
  - OAuth 回调

### 10.2 Investment API

- `GET /api/investments`
  - 获取当前用户的 dashboard snapshot
- `POST /api/investments`
  - 创建投资
- `PATCH /api/investments/:id`
  - 更新投资
- `DELETE /api/investments/:id`
  - 软删除投资，需传 `confirmationText`
- `POST /api/investments/:id/finish`
  - 提前结束或结束投资
- `DELETE /api/investments`
  - 清空当前用户全部投资

### 10.3 Analytics API

- `GET /api/analytics/snapshots`
  - 获取当前用户组合快照历史
- `POST /api/analytics/snapshots`
  - 手动生成当前用户今日快照

### 10.4 Utility API

- `GET /api/exchange-rate`
  - 查询 USD 到目标显示币种的汇率
  - 当前上游为 Frankfurter

### 10.5 Cron API

- `GET /api/cron/snapshots`
  - 为所有 `REMOTE` 用户生成快照
  - 使用 `CRON_SECRET` 鉴权
  - 执行结果写入 `ScheduledJobLog`

## 11. 定时任务与快照

### 11.1 定时任务配置

`wrangler.jsonc` 当前配置：

- 每天 `12:00 UTC` 执行 `/api/cron/snapshots`
- 每天 `02:00 UTC` 执行 `/api/cron/investments/expiry-reminders`

Cloudflare Cron 进入 `custom-worker.js` 的 `scheduled()` handler，然后由 Worker 带上 `Authorization: Bearer <CRON_SECRET>` 转发到现有 cron API 路由。这样业务逻辑仍集中在 `app/api/cron/*` 中。

### 11.2 快照策略

`lib/snapshot-history.js` 会：

1. 拉取用户未删除的投资记录
2. 归一化投资指标
3. 为每条投资写入 `InvestmentDailySnapshot`
4. 聚合写入 `PortfolioDailySnapshot`
5. 记录任务日志

### 11.3 适用范围

Cron 只处理数据库中 `storageMode = REMOTE` 的用户。

## 12. 环境变量

生产部署至少需要：

- `DATABASE_URL`
- `AUTH_SECRET`
- `CRON_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

按需启用 OAuth：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## 13. 部署说明

项目默认面向 Cloudflare Workers 部署：

- `DEPLOY.md` 已说明生产环境变量、Cloudflare secrets 和 preview/deploy 命令
- 使用 OpenNext for Cloudflare 构建 Next.js SSR/API 应用
- 使用 Cloudflare Cron 调度快照与到期提醒任务
- 使用 PostgreSQL 作为正式数据源
- Prisma 通过 `@prisma/adapter-pg` 适配 Cloudflare Workers 运行时

典型部署顺序：

1. 准备或保留 PostgreSQL
2. 配置 Cloudflare 环境变量和 secrets
3. 执行 `prisma migrate deploy` 或 `prisma db push`
4. 执行 `npm run deploy`
5. 在分析页手动捕获首个快照，或等待 Cron

## 14. 当前代码与旧方案的差异

旧 `techplan.md` 中有几处与现状明显不一致：

- 数据库不是 SQLite，而是 PostgreSQL
- 鉴权不是 NextAuth，而是自定义 session + OAuth
- 图表不是 TradingView，而是 Recharts
- UI 不是以 Ant Design 为主，而是基于 Radix + Tailwind 的自定义组件
- 当前主体验是预览模式 + 远程真实数据，不是完整成熟的双模式前台切换

## 15. 后续技术建议

- 将全仓库逐步统一到 TypeScript
- 为关键 API 和计算逻辑补充测试
- 明确 `clearAllInvestments` 与“软删除”策略的语义边界
- 补充 middleware / route guard，进一步统一登录访问控制
- 若继续推进本地模式，补全本地模式的完整产品路径与同步策略
