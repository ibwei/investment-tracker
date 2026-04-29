# Earn Compass 技术文档

## 1. 文档目的

本文档基于当前仓库代码，描述 Earn Compass 的最新技术实现、系统结构、数据库、API、Cron、邮件、Assets 模块和 Cloudflare Workers 部署方式。它用于替代旧版技术方案中关于 SQLite、NextAuth、Vercel 优先部署、TradingView 或完整 Local/Remote 双模式产品的过时描述。

## 2. 技术概览

Earn Compass 当前是一个 Next.js 全栈应用，前端页面、服务端 API、鉴权逻辑、数据库访问、投资计算、资产同步、快照任务和邮件提醒都在同一仓库中维护。

### 2.1 当前技术栈

- 框架：Next.js 16 App Router
- 前端：React 19
- 语言：TypeScript + JavaScript 混合，当前新增核心代码以 `.ts/.tsx` 为主
- 样式：Tailwind CSS 4
- UI：本地 UI primitive wrappers、Radix UI、少量 Ant Design 依赖和遗留工作台组件
- 状态管理：Zustand
- 表单与校验：react-hook-form + zod
- 图表：Recharts
- 数据库：PostgreSQL
- 数据库访问：`pg` Client + 参数化 SQL repository
- Cloudflare 数据库连接：优先 Hyperdrive binding，fallback 到 `DATABASE_URL`
- 本地存储：Dexie / IndexedDB
- 鉴权：自定义 session cookie + Google/GitHub OAuth
- 邮件：Resend
- 资产来源：CEX REST API + OKX Web3 wallet / DeFi API + 手动资产
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
4. 领域服务层：`lib/investments.ts`、`lib/snapshot.ts`、`lib/snapshot-history.ts`、`lib/users.ts`、`lib/assets/service.ts`
5. 基础设施层：`lib/db.ts`、`lib/auth.ts`、`lib/oauth.ts`、`lib/email.ts`
6. 资产基础设施层：`lib/assets/encryption.ts`、`lib/assets/adapters/*`
7. 存储抽象层：`lib/storage/repositories/*`、`lib/storage/dexie/*`

### 3.2 数据模式

当前成熟产品路径是：

- 未登录用户：预览模式，使用 `previewInvestments`、`previewSnapshots` 和 `lib/assets/preview-data.ts`，只读
- 登录用户：远程模式，通过 API 读写 PostgreSQL 中属于自己的数据

仍然存在但不是主产品路径的能力：

- `storageMode` 抽象
- Dexie / IndexedDB 本地 repository
- 部分 Ant Design 工作台组件，如 `components/dashboard-workspace.tsx`、`components/analysis-workspace.tsx`、`components/settings-workspace.tsx`

当前主路由入口使用的是 `app/page.tsx`、`app/assets/page.tsx`、`app/analytics/page.tsx`、`app/settings/page.tsx` 对应的 Tailwind/Radix UI 体验。

## 4. 前端结构

### 4.1 路由

- `/`：Dashboard，投资看板和投资列表
- `/assets`：Assets，资产总览、来源、手动资产、余额、仓位、趋势和同步健康状态
- `/analytics`：Analytics，组合收益和快照分析
- `/settings`：Settings，账户资料、偏好、导出和清空数据
- `/login`：登录
- `/register`：注册和邮箱验证码

### 4.2 主要组件

- `components/layout/navbar.tsx`
  - 顶部导航、登录态展示、语言切换、移动端菜单
- `components/auth-provider.tsx`
  - 客户端登录态上下文
- `components/dashboard/*`
  - 统计卡片、筛选器、投资表格、投资表单
- `components/assets/*`
  - 资产摘要、分布图、趋势图、资产来源表单和列表、手动资产表单和列表、余额表、健康面板、Top 资产
- `components/analytics/*`
  - 收入概览、真实快照趋势、收益趋势、APR 分布、项目拆分、组合波动
- `components/ui/*`
  - 基础 UI primitive wrappers

### 4.3 Assets 页面加载策略

`app/assets/page.tsx` 是 client page。它的首屏只加载：

- 未登录：`lib/assets/preview-data.ts`
- 已登录：`GET /api/assets/summary`

详情按 tab 懒加载：

- `Trend` -> `GET /api/assets/snapshots?days=<range>`
- `Sources` -> `GET /api/assets/sources`
- `Manual` -> `GET /api/assets/manual`
- `Balances` -> `GET /api/assets/balances` + `GET /api/assets/positions`
- `Health` -> `GET /api/assets/health`

已加载 tab 在页面会话内缓存；同步、添加来源、编辑来源、编辑手动资产或删除后刷新 summary 和已打开详情。

### 4.4 国际化、币种和时区

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

`lib/store.ts` 是当前主 Dashboard 使用的投资状态仓库，负责：

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

远程 repository 通过 HTTP API 操作 PostgreSQL。本地 repository 使用 Dexie，并按 `local-user-scope` 隔离数据。

## 6. 数据库与持久化

### 6.1 PostgreSQL 访问

正式数据源是 PostgreSQL。schema 位于 `db/schema.sql`。

数据库访问位于 `lib/db.ts`，实现要点：

- 使用 `pg.Client`，每次 query/transaction 创建短连接
- Cloudflare runtime 中优先读取 `HYPERDRIVE.connectionString`
- 本地 Hyperdrive placeholder 会被忽略
- 非 Hyperdrive 场景 fallback 到 `DATABASE_URL`
- 非本地数据库默认启用 SSL，`sslmode=disable` 可显式关闭
- transient 连接错误最多重试 3 次
- transient 失败最终转换为 503
- 提供 `query`、`queryOne`、`execute`、`withTransaction`
- 所有业务 SQL 使用参数化查询

### 6.2 核心表

- `users`
  - 用户邮箱、密码 hash、姓名、角色、状态、存储模式、时区
- `auth_accounts`
  - OAuth provider 账号映射
- `email_verification_codes`
  - 注册验证码 hash、有效期和消费状态
- `investments`
  - 投资主记录
- `investment_daily_snapshots`
  - 单笔投资每日快照
- `portfolio_daily_snapshots`
  - 用户收益组合每日快照
- `asset_sources`
  - CEX / On-chain 资产来源
- `asset_balances`
  - token / 余额当前态
- `asset_positions`
  - DeFi / 结构化仓位当前态
- `manual_assets`
  - 用户手动维护资产
- `asset_snapshots`
  - 用户资产总览每日快照
- `asset_sync_logs`
  - 资产来源同步日志
- `operation_logs`
  - 操作日志预留表
- `scheduled_job_logs`
  - 定时任务执行日志

### 6.3 用户状态和存储模式

`users.storage_mode` schema 默认值是 `LOCAL`，但当前注册和 OAuth 创建用户时写入的是 `REMOTE`。投资 Cron 快照任务只处理 `storage_mode = 'REMOTE'` 的用户。

`users.status` 当前注册和 OAuth 用户为 `ACTIVE`。到期提醒邮件只发送给 `users.status = 'ACTIVE'` 且存在 `ONGOING` 投资的用户。

### 6.4 Dexie / IndexedDB

本地库定义于 `lib/storage/dexie/client.ts`：

- 数据库名：`cefidefi-local`
- 表：`investments`、`settings`

本地仓库当前主要作为存储抽象和后续扩展保留，不是登录用户的默认生产路径。

## 7. 鉴权与账户

### 7.1 Session

项目不使用 NextAuth。当前鉴权由 `lib/auth.ts` 实现：

- session cookie 名称：`earn_compass_session`
- session payload：`userId`、`email`、`exp`
- 签名：HMAC-SHA256
- 有效期：30 天
- cookie：`httpOnly`、`sameSite=lax`、生产环境 `secure`
- 密码哈希：Node `scrypt`

生产环境必须配置强 `AUTH_SECRET`。本地开发没有配置时会使用开发 fallback，但生产不可依赖 fallback。

### 7.2 邮箱密码账户

`lib/users.ts` 提供：

- 注册
- 登录
- 用户资料更新
- 用户时区读取
- OAuth 用户查找、绑定和创建

注册规则：

- email 必填且唯一
- password 最少 8 位
- 必须提供有效注册验证码
- 新用户状态为 `ACTIVE`
- 新用户存储模式为 `REMOTE`
- 默认时区为 `Asia/Shanghai`

当前资料更新规则：

- 可更新姓名和时区
- 邮箱不能修改

### 7.3 邮箱验证码

`lib/email-verification.ts` 实现注册验证码：

- API：`POST /api/auth/email-verification`
- purpose：`REGISTER`
- 验证码：6 位数字
- 有效期：10 分钟
- 同一邮箱发送冷却：60 秒
- hash：`sha256(email:code:AUTH_SECRET)`
- 消费：注册事务中校验并标记 `consumed_at`
- 邮件发送失败会将新验证码标记为已消费

### 7.4 OAuth

`lib/oauth.ts` 支持：

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

定义在 `lib/calculations.ts`：

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

主要计算逻辑在 `lib/calculations.ts` 和 `lib/snapshot.ts`。

关键规则：

- 持有天数最少按 1 天计算
- 活跃投资优先使用预期 APR 推导收益
- 已结束投资优先使用手动录入的实际 APR 或最终总收益
- 如果最终总收益存在，可以基于本金和持有天数反推实际 APR
- Dashboard summary 聚合活跃本金、累计收益、日/周/月/年收益、加权 APR

## 9. Assets 业务模型

### 9.1 目录结构

当前 Assets 模块主要位于：

```text
app/assets/page.tsx
app/api/assets/*
app/api/cron/assets/sync/route.ts
components/assets/*
lib/assets/
  adapters/
    cex/
    onchain/
  encryption.ts
  preview-data.ts
  service.ts
  types.ts
```

### 9.2 Asset Source

`asset_sources` 表保存资产来源配置：

- `type`: `CEX` 或 `ONCHAIN`
- `provider`: `BINANCE`、`OKX`、`BYBIT`、`BITGET`、`GATE`、`HTX`、`KUCOIN`、`OKX_WEB3`、`AUTO`、`OKX_EVM`、`OKX_SOLANA`、`OKX_SUI`、`OKX_TRON`、`OKX_BITCOIN`、`OKX_TON`
- `name`: 用户自定义来源名称
- `public_ref`: On-chain 钱包地址
- `encrypted_config`: CEX API 凭据加密 JSON
- `status`: `PENDING`、`ACTIVE`、`FAILED`、`DISABLED`
- `last_synced_at` / `last_error`

业务限制：

- 单用户最多 10 个 source
- `syncAllAssetSources` 只处理 `ACTIVE`、`FAILED`、`PENDING`
- 删除 source 为硬删除，依赖外键级联清理 balances、positions、sync logs

### 9.3 Asset Balance

`asset_balances` 表保存 token / 余额当前态：

- `asset_symbol`
- `asset_name`
- `amount`
- `value_usd`
- `category`: `SPOT`、`EARN`、`DEFI`、`CASH`、`DETAIL`、`OTHER`
- `raw_data`

同步时当前实现会先删除该 source 旧余额，再插入本次同步结果。

`DETAIL` 类余额用于保存来源内部明细，不参与 `totalValueUsd` 和 source 总值计算，避免与汇总余额重复计入。

### 9.4 Asset Position

`asset_positions` 表保存 DeFi / 结构化仓位当前态：

- `provider`
- `chain`
- `protocol_id`
- `protocol_name`
- `position_type`: `LP`、`LENDING`、`BORROWING`、`STAKING`、`FARMING`、`VESTING`、`DEFI`、`OTHER`
- `asset_value_usd`
- `debt_value_usd`
- `reward_value_usd`
- `net_value_usd`
- `raw_data`

同步时当前实现会先删除该 source 旧仓位，再插入本次同步结果。

### 9.5 Manual Asset

`manual_assets` 表保存用户手动维护资产：

- `name`
- `type`: `CASH`、`STOCK`、`FUND`、`TOKEN`、`REAL_ESTATE`、`OTHER`
- `amount`
- `value_usd`
- `note`
- `is_deleted`

业务限制：

- 单用户最多 50 个未删除手动资产
- `amount` 和 `value_usd` 必须为非负数
- 删除为软删除
- 创建、更新、删除都会捕获资产快照

### 9.6 Asset Snapshot

`asset_snapshots` 表保存每日资产快照：

- `snapshot_date`
- `total_value_usd`
- `breakdown`
- `created_at`

`breakdown` 当前包含：

- `bySourceType`
- `byCategory`
- `manualAssetsValueUsd`
- `manualAssetsCount`
- `totalNetValueUsd`

### 9.7 Adapter 接口

`lib/assets/adapters/types.ts` 定义统一 adapter：

```ts
type CexAdapter = {
  provider: string;
  testConnection(config: CexConfig): Promise<void>;
  getBalances(config: CexConfig): Promise<NormalizedAssetBalance[]>;
  getPositions?(config: CexConfig): Promise<NormalizedAssetPosition[]>;
};

type OnchainAdapter = {
  provider: string;
  aliases?: string[];
  testConnection(config: OnchainConfig): Promise<void>;
  getBalances(config: OnchainConfig): Promise<NormalizedAssetBalance[]>;
  getPositions(config: OnchainConfig): Promise<NormalizedAssetPosition[]>;
};
```

所有 adapter 统一输出 `NormalizedAssetBalance` 和 `NormalizedAssetPosition`。余额类别支持 `SPOT`、`EARN`、`DEFI`、`CASH`、`DETAIL`、`OTHER`；仓位类型支持 `LP`、`LENDING`、`BORROWING`、`STAKING`、`FARMING`、`VESTING`、`DEFI`、`OTHER`。

当前 CEX adapter：

- `binance.ts`
- `okx.ts`
- `bybit.ts`
- `bitget.ts`
- `gate.ts`
- `htx.ts`
- `kucoin.ts`

当前 On-chain adapter：

- `okx-web3.ts`

### 9.8 OKX Web3 On-chain Adapter

`lib/assets/adapters/onchain/okx-web3.ts` 当前实现：

- provider：`OKX_WEB3`
- aliases：`AUTO`、`OKX`、`OKX_EVM`、`EVM`、`OKX_SOLANA`、`SOLANA`、`OKX_SUI`、`SUI`、`OKX_TRON`、`TRON`、`OKX_BITCOIN`、`BITCOIN`、`BTC`、`OKX_TON`、`TON`
- 需要环境变量 `OKX_WEB3_API_KEY`、`OKX_WEB3_API_SECRET`、`OKX_WEB3_PASSPHRASE`，`OKX_WEB3_PROJECT_ID` 按 OKX app 要求可选
- 默认 base URL：`https://web3.okx.com`
- token 来源：`/api/v6/dex/balance/all-token-balances-by-address`
- DeFi 来源：`/api/v5/defi/user/asset/platform/list`
- 支持 EVM、Solana、Sui、Tron、Bitcoin 和 TON 地址
- token 归一化为 `SPOT` balances
- DeFi platform 归一化为 `DEFI` positions

### 9.9 资产凭据加密

`lib/assets/encryption.ts` 使用 Node `crypto`：

- 算法：AES-256-GCM
- 每条配置生成独立 12 byte IV
- 密文包含 `version`、`iv`、`authTag`、`content`
- 密钥环境变量：`ASSET_CREDENTIAL_ENCRYPTION_KEY`
- 支持 `base64:<32 bytes>`、`hex:<32 bytes>` 或长度至少 32 的 passphrase

### 9.10 CEX Provider 矩阵

| 交易所 | Adapter | 凭据要求 | 当前范围 |
| --- | --- | --- | --- |
| Binance | `binance.ts` | API Key + Secret | 基础余额 |
| OKX | `okx.ts` | API Key + Secret + Passphrase | 基础余额，包含部分 funding / Earn 估值归并 |
| Bybit | `bybit.ts` | API Key + Secret | 基础余额 |
| Bitget | `bitget.ts` | API Key + Secret + Passphrase | 基础余额 |
| Gate | `gate.ts` | API Key + Secret | 基础余额 |
| HTX | `htx.ts` | API Key + Secret | 基础余额，包含 `deposit-earning` 理财账户和 Earn 估值补差 |
| KuCoin | `kucoin.ts` | API Key + Secret + Passphrase + API Key Version | 基础余额 |

用户应创建 read-only API Key。服务端不实现交易、提现、划转或下单能力；adapter 不应把 API Secret、签名 payload 或完整敏感外部响应写入日志。

## 10. API 设计

所有用户数据 API 必须通过 `requireSession()` 获取 `session.userId`，并按当前用户过滤数据。动态 API route 基本都设置：

```ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
```

### 10.1 Auth API

- `POST /api/auth/email-verification`
  - 发送注册邮箱验证码
- `POST /api/auth/register`
  - 校验验证码，创建用户，设置 session cookie
- `POST /api/auth/login`
  - 校验邮箱密码，设置 session cookie
- `POST /api/auth/logout`
  - 清除 session cookie
- `GET /api/auth/session`
  - 返回当前用户
- `PATCH /api/auth/session`
  - 更新当前用户姓名和时区；邮箱不可修改
- `GET /api/auth/providers`
  - 返回 Google/GitHub provider 是否已配置
- `GET /api/auth/oauth/:provider`
  - 发起 OAuth
- `GET /api/auth/oauth/:provider/callback`
  - OAuth 回调

### 10.2 Investment API

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

### 10.3 Analytics API

- `GET /api/analytics/snapshots`
  - 查询当前用户组合快照历史
  - 支持 `days` 或 `startDate`
- `POST /api/analytics/snapshots`
  - 手动生成当前用户今日快照

### 10.4 Assets API

- `GET /api/assets`
  - 兼容入口，复用 summary
- `GET /api/assets/summary`
  - 获取当前用户资产总览、分布、Top assets 和健康摘要
- `GET /api/assets/sources`
  - 查询资产来源，支持 `status`、`type`、`limit`、`offset`、`sort`
- `POST /api/assets/sources`
  - 创建资产来源并立即尝试同步
- `GET /api/assets/sources/:id`
  - 查询单个资产来源摘要
- `PATCH /api/assets/sources/:id`
  - 更新来源名称、状态、地址或 CEX 凭据
- `DELETE /api/assets/sources/:id`
  - 删除当前用户资产来源
- `POST /api/assets/sources/:id/sync`
  - 同步当前用户指定资产来源
- `GET /api/assets/sources/:id/balances`
  - 查询指定来源余额
- `GET /api/assets/sources/:id/positions`
  - 查询指定来源仓位
- `POST /api/assets/sync`
  - 同步当前用户全部启用来源
- `GET /api/assets/balances`
  - 查询资产余额，支持 `limit`、`offset`、`sourceId`、`sourceType`、`category`、`q`、`sort`
- `GET /api/assets/positions`
  - 查询 DeFi / 结构化仓位，支持 `limit`、`offset`、`sourceId`、`chain`、`protocol`、`positionType`、`sort`
- `GET /api/assets/manual`
  - 查询未删除手动资产，支持 `limit`、`offset`、`type`、`q`
- `POST /api/assets/manual`
  - 新增手动资产并捕获快照
- `PATCH /api/assets/manual/:id`
  - 更新手动资产并捕获快照
- `DELETE /api/assets/manual/:id`
  - 软删除手动资产并捕获快照
- `GET /api/assets/snapshots`
  - 查询资产快照，支持 `days`、`startDate`、`endDate`
- `POST /api/assets/snapshots`
  - 手动捕获当前用户资产快照
- `GET /api/assets/health`
  - 查询失败来源和最近同步日志，支持 `limit`、`sourceId`、`status`

### 10.5 Utility API

- `GET /api/exchange-rate`
  - 查询 USD 到目标显示币种的汇率
  - 当前上游为 Frankfurter
- `GET /api/diagnostics/egress`
  - 诊断 Worker 到各 CEX 公共 API 的 egress 访问情况
  - 支持 `targets` 和 `includeIp=true`

### 10.6 Cron API

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
- `GET /api/cron/assets/sync`
  - 同步所有 `ACTIVE`、`FAILED`、`PENDING` 资产来源
  - 写入 `scheduled_job_logs`，jobName 为 `asset-source-sync`

## 11. 快照与定时任务

### 11.1 投资快照策略

`lib/snapshot-history.ts` 负责：

1. 读取用户未删除投资记录
2. 按用户时区生成 `snapshot_date`
3. 归一化每条投资的收益指标
4. upsert `investment_daily_snapshots`
5. 聚合并 upsert `portfolio_daily_snapshots`

`captureSnapshotsForRemoteUsers()` 只处理 `storage_mode = 'REMOTE'` 的用户。

### 11.2 投资自动结算

`autoSettleMaturedInvestments()` 会查找：

- `is_deleted = false`
- `status = 'ONGOING'`
- `end_time is not null`
- `end_time <= referenceDate`

匹配记录会被批量更新为 `ENDED`。

### 11.3 到期提醒邮件

`lib/investment-expiry-reminders.ts` 负责：

- 查询所有活跃用户的 `ONGOING` 投资
- 按用户分组
- 统计未来 24 小时内到期投资
- 构建 HTML 和 text 邮件
- 通过 `lib/email.ts` 调用 Resend

当前行为是：只要用户存在活跃投资，每天 10:00 和 22:00（UTC+8）都会收到摘要邮件；未来 24 小时内到期的项目在邮件中优先展示。

### 11.4 资产快照策略

`captureAssetSnapshot()` 负责：

1. 读取当前用户所有 asset balances
2. 读取当前用户所有 asset positions
3. 读取当前用户所有未删除 manual assets
4. 汇总 `totalValueUsd`
5. 生成 source type 和 category breakdown
6. upsert `asset_snapshots`

同一用户同一天只保留一条资产快照。

### 11.5 资产同步策略

`syncAssetSource()` 负责：

1. 按 `userId + sourceId` 读取来源
2. CEX 解密配置并调用对应 adapter
3. On-chain 读取 `publicRef` 并调用 on-chain adapter
4. 成功时覆盖该来源 balances 和 positions
5. 更新 source status、`last_synced_at`、`last_error`
6. 写入 `asset_sync_logs`
7. 捕获资产快照

`syncAllAssetSources()` 同步当前用户所有 `ACTIVE`、`FAILED`、`PENDING` 来源。

`captureAssetsForAllUsers()` 为 Cron 扫描所有 `ACTIVE`、`FAILED`、`PENDING` 来源，逐个同步，并为受影响用户捕获资产快照。

`createAssetSource()` 会在写入 source 前先调用 adapter 完成首次同步。首次同步失败时返回错误，不保存不可用 source；后续已存在 source 的同步失败会更新该 source 为 `FAILED`，写入 `asset_sync_logs`，并保留错误摘要。

当前手动同步没有严格的服务端节流。UI 会显示 loading 状态，但后续仍需要增加节流、分页或队列化，降低外部 API rate limit 和 Worker 执行时长风险。

## 12. Cloudflare Workers 部署

### 12.1 构建与入口

部署目标是 Cloudflare Workers。OpenNext for Cloudflare 构建产物由 `custom-worker.js` 引入：

- `npm run build` 生成 `.open-next/worker.js` 和 `.open-next/assets`
- `wrangler.jsonc` 的 `main` 指向 `./custom-worker.js`
- `custom-worker.js` 的 `fetch` 直接委托给 OpenNext Worker
- `custom-worker.js` 的 `scheduled()` 根据 cron 表达式转发到内部 API

### 12.2 Wrangler 配置

`wrangler.jsonc` 当前要点：

- Worker 名称：`investment-tracker`
- `compatibility_date`: `2026-04-12`
- `compatibility_flags`: `["nodejs_compat"]`
- assets directory：`.open-next/assets`
- Hyperdrive binding：`HYPERDRIVE`
- `keep_vars: true`
- placement region：`aws:ap-northeast-1`
- Cron：
  - `0 */12 * * *`
  - `0 */4 * * *`
  - `0 1/4 * * *`
  - `0 2 * * *`
  - `0 14 * * *`
- observability 配置中 logs 和 traces 均开启持久化，但顶层 `observability.enabled` 当前为 `false`

`keep_vars: true` 表示 Cloudflare Dashboard 中配置的 runtime vars 会在 deploy 时保留。Secrets 仍应通过 Cloudflare Secrets 管理，不应写入仓库。

### 12.3 Cron 映射

`custom-worker.js` 当前映射：

- `0 */12 * * *` -> `/api/cron/snapshots`
- `0 */4 * * *` -> `/api/cron/assets/sync`
- `0 1/4 * * *` -> `/api/cron/investments/settle`
- `0 2 * * *` -> `/api/cron/investments/expiry-reminders`
- `0 14 * * *` -> `/api/cron/investments/expiry-reminders`

Cloudflare Cron 使用 UTC：

- `0 */12 * * *` = 每 12 小时一次
- `0 */4 * * *` = 每 4 小时一次
- `0 1/4 * * *` = 每 4 小时一次，较整点 4 小时任务错峰 1 小时
- `02:00 UTC` = `10:00 Asia/Shanghai`
- `14:00 UTC` = `22:00 Asia/Shanghai`

`/api/cron/investments/settle` 是独立自动结算 route，并已单独配置 Cloudflare Cron。`/api/cron/snapshots` 仍会在采集快照前执行一次自动结算，确保快照数据包含最新到期状态。

### 12.4 环境变量

生产必需：

- `AUTH_SECRET`
- `CRON_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ASSET_CREDENTIAL_ENCRYPTION_KEY`

数据库连接至少需要一种：

- `HYPERDRIVE` binding
- `DATABASE_URL`

Assets on-chain provider：

- `OKX_WEB3_API_KEY`
- `OKX_WEB3_API_SECRET`
- `OKX_WEB3_PASSPHRASE`
- `OKX_WEB3_PROJECT_ID`

OAuth 可选：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

### 12.5 数据库连接要求

当前部署方案可以通过 Cloudflare Hyperdrive 或直接 `DATABASE_URL` 连接 PostgreSQL：

- Hyperdrive binding 存在时优先使用
- 直接 `DATABASE_URL` 时数据库必须允许 Cloudflare Workers 外部连接
- SSL 配置与数据库服务匹配
- 连接数限制能接受 Workers 场景下的短连接行为

## 13. 当前代码与旧方案差异

- 数据库不是 SQLite，而是 PostgreSQL
- 鉴权不是 NextAuth，而是自定义 session cookie + OAuth
- 注册流程已经加入邮箱验证码
- 部署基线不是 Vercel，而是 Cloudflare Workers + OpenNext
- 数据库连接已支持 Cloudflare Hyperdrive
- 图表不是 TradingView，而是 Recharts
- UI 主路径不是 Ant Design-first，而是 Tailwind/Radix/本地 UI primitives；Ant Design 组件仍作为依赖和遗留工作台存在
- 当前成熟路径是“游客预览 + 登录后远程数据”，不是完整成熟的前台 Local/Remote 双模式产品
- Prisma 不在运行时使用，数据库访问是 `pg` + 参数化 SQL
- Cron 已经落地，包括投资快照、自动结算、到期提醒邮件和资产来源同步
- Assets 模块已经落地，不再只是未来设计文档

## 14. 后续技术建议

- 为 `lib/calculations.ts`、`lib/snapshot.ts`、`lib/investments.ts`、`lib/assets/service.ts` 增加单元测试
- 为 Auth、Investment、Assets、Analytics、Cron API 增加集成测试
- 明确 `DELETE /api/investments` 的硬删除语义是否符合产品预期
- 为资产同步增加手动触发节流，避免误触发外部 API rate limit
- 为资产 Cron 增加分页、分片或队列化，避免用户量增长后单次 Worker 执行过长
- 为 CEX raw data 和 external error 增加更严格的敏感字段过滤
- 如果继续保留 Local Mode，补齐其完整 UI、Analytics 和同步策略；否则减少暴露面
- 将遗留 Ant Design 工作台组件归档或迁移到当前主 UI 体系
- 补充生产级日志、告警和邮件发送失败重试策略
- 为到期提醒增加用户级通知偏好持久化，避免每天固定发送给所有活跃投资用户
