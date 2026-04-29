# Assets 模块 PRD 与技术方案

## 1. 文档目的

本文档基于当前 Earn Compass 代码，定义 Assets 模块已经实现的产品范围、数据模型、API、同步任务和安全边界。它不再是纯未来方案；当前 `/assets` 页面、Assets API、CEX adapters、OKX Web3 adapter、手动资产、资产快照和资产同步 Cron 已经在代码中落地。

## 2. 模块定位

Assets 模块用于聚合用户在多个资产来源中的资产余额和仓位，并以只读或受控编辑方式展示总资产、资产分布、来源状态和历史变化趋势。

它是现有 Investment 模块的补充：

- Investment：用户手动记录收益型投资，用于 APR、收益、到期和投资快照管理
- Assets：系统读取 CEX / 链上资产来源，并允许用户手动维护无法自动同步的资产，用于总资产、币种分布、平台分布、同步健康状态和资产历史趋势

Assets 不替代 Investment。当前两套数据独立维护，后续可在 Dashboard 或 Analytics 中做组合视角融合。

## 3. 当前系统约束

Assets 模块符合当前项目基线：

- Next.js 16 App Router
- React 19
- Tailwind CSS 4 + Radix UI / 本地 UI primitives
- Recharts 图表
- PostgreSQL 正式数据源
- `pg` + 参数化 SQL
- 自定义 session cookie 鉴权，不使用 NextAuth
- 用户数据通过 `requireSession()` 保护并按 `session.userId` 隔离
- 部署目标是 Cloudflare Workers + OpenNext for Cloudflare
- 数据库连接优先使用 Cloudflare Hyperdrive，fallback 到 `DATABASE_URL`
- 定时任务使用 Cloudflare Cron 转发到 `app/api/cron/*`
- Cron API 使用 `CRON_SECRET` 鉴权
- 未登录用户只能看到预览数据，不允许真实写入或同步

## 4. 产品范围

### 4.1 已实现能力

- `/assets` 页面
- 预览态 mock assets 数据
- 登录用户添加、编辑、删除资产来源
- 登录用户添加、编辑、删除手动资产
- 总资产摘要
- 来源类型分布
- 类别分布
- Top 资产列表
- 资产快照趋势
- 资产来源列表
- 手动资产列表
- 余额明细列表
- DeFi / 结构化仓位列表
- 同步健康面板
- 单来源手动同步
- 全部来源手动同步
- 每 4 小时 Cron 批量同步
- CEX API 凭据 AES-256-GCM 加密
- 资产同步日志

### 4.2 已实现 Provider

CEX 基础余额 adapter：

- Binance
- OKX
- Bybit
- Bitget
- Gate
- HTX
- KuCoin

On-chain portfolio adapter：

- OKX Web3
- Provider aliases：`AUTO`、`OKX_EVM`、`OKX_SOLANA`、`OKX_SUI`、`OKX_TRON`、`OKX_BITCOIN`、`OKX_TON`
- 支持 EVM、Solana、Sui、Tron、Bitcoin 和 TON 地址
- 覆盖 wallet token balances 和 DeFi positions

### 4.3 非目标

- 不提供交易执行
- 不提供资产划转
- 不托管资金
- 不要求钱包签名
- 不保存钱包私钥或助记词
- 不做高频实时行情或高频资产刷新
- 不替代 Investment 的 APR、收益和到期管理
- 当前不做 NFT、税务报表或复杂成本价追踪

## 5. 用户角色与权限

### 5.1 游客

游客可访问 `/assets` 的预览态页面，查看 mock 资产来源、mock 总资产、mock 分布图、mock 趋势和 mock 健康状态。

游客限制：

- 不能添加资产来源
- 不能添加手动资产
- 不能保存 API Key
- 不能触发真实同步
- 不能删除真实资产来源

### 5.2 已登录用户

已登录用户可：

- 添加自己的资产来源
- 添加、编辑和删除自己的手动资产
- 查看自己的资产余额、仓位和资产快照
- 手动触发自己的单来源或全部来源同步
- 删除自己的资产来源
- 查看同步失败原因摘要和最近同步日志

服务端保证：

- 所有 Assets API 都按 `session.userId` 过滤
- 用户不能读取、同步、编辑或删除他人的资产来源和手动资产
- Cron 只处理数据库中真实用户的资产来源，不能处理游客预览数据
- API 不返回 `encrypted_config`、API Secret、签名 payload 或加密密钥

## 6. 核心使用场景

### 6.1 添加 CEX 资产来源

用户选择交易所并填写只读 API 凭据。

输入字段：

- 来源类型：`CEX`
- 交易所 provider
- 来源名称，可选，默认使用 provider
- API Key
- API Secret
- Passphrase，按交易所需要可选
- API Key Version，当前主要用于 KuCoin，默认 `3`

系统行为：

1. 校验用户已登录
2. 校验 source 数量不超过 10
3. 校验字段完整性
4. 使用 `ASSET_CREDENTIAL_ENCRYPTION_KEY` 加密保存敏感凭据
5. 创建 `PENDING` source
6. 立即调用对应 CEX adapter 同步余额
7. 成功时写入 `asset_balances`，source 标记为 `ACTIVE`
8. 失败时 source 标记为 `FAILED`，记录错误摘要
9. 写入 `asset_sync_logs`
10. 捕获当前用户资产快照
11. 返回最新 source 和 summary

当前 CEX 同步范围：

- 基础账户 / 现货 / funding 等基础余额，按各交易所 adapter 实现
- 标准化为 `NormalizedAssetBalance`
- 当前不保证覆盖 Earn / staking / 理财产品明细、合约仓位或复杂衍生品风险指标

### 6.2 添加 On-chain 资产来源

用户添加钱包地址，系统通过 OKX Web3 读取 wallet token 和 DeFi positions。

输入字段：

- 来源类型：`ONCHAIN`
- Provider：`OKX_WEB3`、`AUTO` 或具体链别 provider
- 钱包地址
- 来源名称，可选

系统行为：

1. 校验用户已登录
2. 校验 source 数量不超过 10
3. 保存公开地址到 `public_ref`
4. 调用 OKX Web3 adapter 拉取 token balances 和 DeFi positions
5. 标准化资产余额、协议仓位和负债
6. 写入 `asset_balances` 和 `asset_positions`
7. 捕获资产快照

当前 OKX Web3 adapter 规则：

- 需要环境变量 `OKX_WEB3_API_KEY`、`OKX_WEB3_API_SECRET`、`OKX_WEB3_PASSPHRASE`
- `OKX_WEB3_PROJECT_ID` 按 OKX app 要求可选
- 支持 EVM、Solana、Sui、Tron、Bitcoin 和 TON 地址
- token balances 使用 `SPOT` category
- DeFi platform position 使用 `DEFI` category 和 provider 返回的 USD value

### 6.3 添加手动资产

用户可以手动添加无法自动追踪或暂不适合接入第三方 API 的资产。这类资产不需要外部同步，但参与总资产、资产分布和资产快照采集。

支持类型：

- `CASH`
- `STOCK`
- `FUND`
- `TOKEN`
- `REAL_ESTATE`
- `OTHER`

输入字段：

- 名称
- 类型
- 金额，用于记录原始数量或本位金额
- 美元本位数量，即 `valueUsd`
- 备注，可选

系统行为：

1. 校验用户已登录
2. 校验未删除手动资产数量不超过 50
3. 校验名称、类型、金额和美元本位数量
4. 金额和美元本位数量必须为非负数
5. 保存手动资产记录
6. 重新捕获当前用户资产快照
7. 返回最新 summary

删除手动资产是软删除，会设置 `is_deleted = true` 和 `deleted_at`。

### 6.4 查看资产总览

用户在 `/assets` 页面查看：

- 总资产，按用户显示币种展示
- 变化金额和变化百分比
- 来源数量
- 手动资产数量
- 失败来源数量
- 最近同步时间
- 按来源类型分布：CEX、On-chain、Manual
- 按类别分布：Spot、Earn、DeFi、Cash、Stock、Fund、Real Estate、Other 等
- Top 资产
- 资产趋势
- 资产来源列表
- 手动资产列表
- 资产余额明细
- DeFi / 结构化仓位
- 同步健康状态

### 6.5 手动同步

用户可在 `/assets` 手动同步：

- 单个资产来源
- 全部资产来源

当前行为：

- 同步中按钮进入 loading 状态
- 成功后刷新 summary 和已打开 tab
- 失败时更新来源状态并展示简短错误
- 手动资产不执行同步，但会在用户编辑后重新采集快照

当前代码未实现严格的服务端手动同步节流，后续需要补齐。

### 6.6 定时同步

系统通过 Cloudflare Cron 周期性同步资产：

- Cron 表达式：`0 */4 * * *`
- Route：`GET /api/cron/assets/sync`
- 只处理 `ACTIVE`、`FAILED`、`PENDING` 资产来源
- 单个 source 失败会记录失败状态和 sync log
- 整体任务写入 `scheduled_job_logs`
- 同步结束后捕获资产快照，包含当前用户未删除的手动资产

## 7. 信息架构

### 7.1 页面

主页面：

- `/assets`

导航位置：

- Dashboard 之后，Analytics 之前

页面结构：

1. 预览/登录提示条
2. 总资产摘要
3. 来源类型和类别分布
4. Top 资产
5. `Overview` tab
6. `Trend` tab
7. `Sources` tab
8. `Manual` tab
9. `Balances` tab
10. `Health` tab
11. 新增 / 编辑资产来源弹窗
12. 新增 / 编辑手动资产弹窗

### 7.2 与现有页面关系

- Dashboard 当前不直接依赖 Assets
- Analytics 当前不混合 Assets 数据
- Settings 当前没有 Assets 同步偏好或 API Key 管理入口
- 未来可在 Dashboard 增加“总资产 / 活跃投资本金 / 现金余额”对比

## 8. UI 与加载策略

### 8.1 设计原则

- 延续当前主 UI 体系：Tailwind CSS 4 + 本地 UI primitives + Radix UI
- 图表使用 Recharts，与 Analytics 保持一致
- 未登录状态展示 mock 数据和只读提示
- 所有真实写操作在未登录时禁用或跳转登录
- API Key / Secret 输入不回显明文
- 同步失败显示可理解的错误摘要，不暴露敏感请求细节
- 手动资产表单需要明确提示 USD value 会计入总资产
- 手动资产备注只在用户自己的页面和 API 响应中展示，不进入公开日志
- 页面按需加载数据，首屏不一次性拉取余额明细、DeFi 仓位、完整趋势和同步日志

### 8.2 当前组件

```text
components/assets/
  asset-allocation-chart.tsx
  asset-balance-table.tsx
  asset-health-panel.tsx
  asset-source-form.tsx
  asset-source-list.tsx
  asset-summary-cards.tsx
  asset-trend-chart.tsx
  manual-asset-form.tsx
  manual-asset-list.tsx
  top-assets-list.tsx
```

### 8.3 首屏与按需展开

首屏默认只请求：

- `GET /api/assets/summary`

首屏展示：

- 总资产
- 变化金额和百分比
- 最近同步时间
- 自动资产来源数量
- 手动资产数量
- 失败来源数量
- 来源类型分布
- 类别分布
- Top 资产

详情请求：

- 打开 `Trend` tab 请求资产快照
- 打开 `Sources` tab 请求 source 列表
- 打开 `Manual` tab 请求手动资产列表
- 打开 `Balances` tab 请求余额和仓位 Top 20
- 打开 `Health` tab 请求失败来源和同步日志

前端状态：

- 每个 tab 独立 loading / error / empty 状态
- 已加载 tab 在本次页面会话内缓存
- 同步或编辑成功后刷新 summary 和已打开详情

## 9. 数据模型

新增 schema 已添加到 `db/schema.sql`。所有用户数据表都包含 `user_id`，并建立用户维度索引。

### 9.1 asset_sources

资产来源配置。

```sql
create table if not exists asset_sources (
  id integer generated by default as identity primary key,
  user_id integer not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  name text not null,
  public_ref text,
  encrypted_config text,
  status text not null default 'PENDING',
  last_synced_at text,
  last_error text,
  created_at text not null,
  updated_at text not null
);
```

索引：

```sql
create index if not exists asset_sources_user_type_idx
  on asset_sources(user_id, type, provider);
```

字段说明：

- `type`: `CEX` 或 `ONCHAIN`
- `provider`: `BINANCE`、`OKX`、`BYBIT`、`BITGET`、`GATE`、`HTX`、`KUCOIN`、`OKX_WEB3`、`AUTO`、`OKX_EVM`、`OKX_SOLANA`、`OKX_SUI`、`OKX_TRON`、`OKX_BITCOIN`、`OKX_TON`
- `public_ref`: CEX 为空；On-chain 存钱包地址
- `encrypted_config`: CEX API 凭据加密后的 JSON；On-chain 为空
- `status`: `PENDING`、`ACTIVE`、`FAILED`、`DISABLED`

### 9.2 asset_balances

资产余额当前态，表示钱包 token、CEX spot/funding 余额等“币种余额”。

```sql
create table if not exists asset_balances (
  id integer generated by default as identity primary key,
  user_id integer not null references users(id) on delete cascade,
  source_id integer not null references asset_sources(id) on delete cascade,
  asset_symbol text not null,
  asset_name text,
  amount double precision not null default 0,
  value_usd double precision not null default 0,
  category text not null default 'OTHER',
  raw_data text,
  updated_at text not null,
  unique (source_id, asset_symbol, category)
);
```

类别：

- `SPOT`
- `EARN`
- `DEFI`
- `CASH`
- `OTHER`

### 9.3 asset_positions

资产仓位当前态，表示 DeFi protocol position、LP、staking、lending/borrow 等结构化仓位。

```sql
create table if not exists asset_positions (
  id integer generated by default as identity primary key,
  user_id integer not null references users(id) on delete cascade,
  source_id integer not null references asset_sources(id) on delete cascade,
  provider text not null,
  chain text,
  protocol_id text,
  protocol_name text,
  position_type text not null default 'DEFI',
  asset_value_usd double precision not null default 0,
  debt_value_usd double precision not null default 0,
  reward_value_usd double precision not null default 0,
  net_value_usd double precision not null default 0,
  raw_data text,
  updated_at text not null,
  unique (source_id, provider, chain, protocol_id, position_type)
);
```

仓位类型：

- `LP`
- `LENDING`
- `BORROWING`
- `STAKING`
- `FARMING`
- `VESTING`
- `DEFI`
- `OTHER`

### 9.4 manual_assets

用户手动维护的资产当前态。它不依赖 `asset_sources`，也不参与外部同步，但参与总资产、分布和快照采集。

```sql
create table if not exists manual_assets (
  id integer generated by default as identity primary key,
  user_id integer not null references users(id) on delete cascade,
  name text not null,
  type text not null,
  amount double precision not null default 0,
  value_usd double precision not null default 0,
  note text,
  is_deleted boolean not null default false,
  deleted_at text,
  created_at text not null,
  updated_at text not null
);
```

类型：

- `CASH`
- `STOCK`
- `FUND`
- `TOKEN`
- `REAL_ESTATE`
- `OTHER`

### 9.5 asset_snapshots

用户资产总览快照。

```sql
create table if not exists asset_snapshots (
  id integer generated by default as identity primary key,
  user_id integer not null references users(id) on delete cascade,
  snapshot_date text not null,
  total_value_usd double precision not null default 0,
  breakdown text,
  created_at text not null,
  unique (user_id, snapshot_date)
);
```

当前快照总资产口径：

```ts
totalValueUsd =
  sum(asset_balances.value_usd) +
  sum(asset_positions.net_value_usd) +
  sum(manual_assets.value_usd where is_deleted = false);
```

`breakdown` 当前包含：

- `bySourceType`
- `byCategory`
- `manualAssetsValueUsd`
- `manualAssetsCount`
- `totalNetValueUsd`

### 9.6 asset_sync_logs

资产同步日志，用于排查第三方 API 问题。

```sql
create table if not exists asset_sync_logs (
  id integer generated by default as identity primary key,
  user_id integer references users(id) on delete cascade,
  source_id integer references asset_sources(id) on delete cascade,
  status text not null,
  balance_count integer not null default 0,
  duration_ms integer,
  error_message text,
  started_at text,
  finished_at text,
  created_at text not null
);
```

## 10. 领域服务与目录结构

当前目录：

```text
lib/assets/
  adapters/
    cex/
      binance.ts
      bitget.ts
      bybit.ts
      common.ts
      gate.ts
      htx.ts
      kucoin.ts
      okx.ts
    onchain/
      okx-web3.ts
    development-proxy.ts
    index.ts
    types.ts
  encryption.ts
  preview-data.ts
  service.ts
  types.ts
```

职责：

- `adapters/*`: 调用外部交易所或链上聚合 API
- `adapters/cex/common.ts`: CEX adapter 公共 fetch、数值和 URL 工具
- `adapters/index.ts`: provider registry
- `encryption.ts`: API 凭据加密/解密
- `preview-data.ts`: 游客预览数据
- `service.ts`: source、balance、position、manual asset、snapshot、sync、health 的领域服务
- `types.ts`: API response 和数据库记录共享类型

## 11. Adapter 设计

### 11.1 标准输出

所有 adapter 输出统一结构：

```ts
type NormalizedAssetBalance = {
  assetSymbol: string;
  assetName?: string;
  amount: number;
  valueUsd: number;
  category: "SPOT" | "EARN" | "DEFI" | "CASH" | "OTHER";
  rawData?: unknown;
};
```

DeFi 和结构化仓位使用单独结构：

```ts
type NormalizedAssetPosition = {
  provider: string;
  chain?: string;
  protocolId?: string;
  protocolName?: string;
  positionType: "LP" | "LENDING" | "BORROWING" | "STAKING" | "FARMING" | "VESTING" | "DEFI" | "OTHER";
  assetValueUsd: number;
  debtValueUsd: number;
  rewardValueUsd: number;
  netValueUsd: number;
  rawData?: unknown;
};
```

用户总资产使用净值口径：

```ts
totalNetValueUsd =
  sum(tokenBalances.valueUsd) +
  sum(positions.netValueUsd) +
  sum(manualAssets.valueUsd);
```

### 11.2 CEX Adapter

统一接口：

```ts
type CexAdapter = {
  provider: string;
  testConnection(config: CexConfig): Promise<void>;
  getBalances(config: CexConfig): Promise<NormalizedAssetBalance[]>;
  getPositions?(config: CexConfig): Promise<NormalizedAssetPosition[]>;
};
```

要求：

- 仅使用 read-only API Key
- 不实现交易、划转或提现
- 对交易所 API rate limit 做错误分类
- 不把 API Secret 写入日志
- 单个 adapter 独立处理交易所签名规则

### 11.3 CEX Provider 矩阵

| 交易所 | 当前 adapter | 主要用途 | 凭据要点 |
| --- | --- | --- | --- |
| Binance | `binance.ts` | 基础余额 | API Key + Secret |
| OKX | `okx.ts` | 基础余额 | API Key + Secret + Passphrase |
| Bybit | `bybit.ts` | 基础余额 | API Key + Secret |
| Bitget | `bitget.ts` | 基础余额 | API Key + Secret + Passphrase |
| Gate | `gate.ts` | 基础余额 | API Key + Secret |
| HTX | `htx.ts` | 基础余额，包含 `deposit-earning` 理财账户和 Earn 估值补差 | API Key + Secret |
| KuCoin | `kucoin.ts` | 基础余额 | API Key + Secret + Passphrase + API Key Version |

### 11.4 On-chain Adapter

当前统一接口：

```ts
type OnchainAdapter = {
  provider: string;
  aliases?: string[];
  testConnection(config: OnchainConfig): Promise<void>;
  getBalances(config: OnchainConfig): Promise<NormalizedAssetBalance[]>;
  getPositions(config: OnchainConfig): Promise<NormalizedAssetPosition[]>;
};
```

当前实现：

- OKX Web3 provider
- `AUTO` 和具体链别 alias
- 地址格式推断 EVM、Solana、Sui、Tron、Bitcoin 和 TON
- OKX token balance 标准化为 balances
- OKX DeFi platform list 标准化为 positions

后续可扩展：

- Alchemy Portfolio API token fallback
- Solana provider，例如 Helius
- Sui provider，例如官方 RPC 或 BlockPI
- Zapper / Covalent 等 DeFi 增强 provider

## 12. API 设计

所有 route handler 都要求登录，除游客页面直接使用 preview data，不通过真实 API 写入。

### 12.1 Summary API

- `GET /api/assets/summary`
  - 首屏接口，只返回当前用户资产总览和轻量概览
  - 包含 summary、meta、topAssets、sourceTypeBreakdown、categoryBreakdown、healthSummary
  - 不返回完整 sources、balances、positions、manualAssets 或 sync logs

- `GET /api/assets`
  - 兼容入口，当前直接复用 summary route

### 12.2 Asset Sources API

- `GET /api/assets/sources`
  - 支持 `status`、`type`、`limit`、`offset`、`sort`
- `POST /api/assets/sources`
  - 添加资产来源，保存后首次同步
- `GET /api/assets/sources/:id`
  - 读取单个 source 详情和轻量统计
- `PATCH /api/assets/sources/:id`
  - 更新来源名称、状态、地址或凭据
- `DELETE /api/assets/sources/:id`
  - 硬删除 source，并级联删除 balances、positions、sync logs
- `GET /api/assets/sources/:id/balances`
  - 按需分页读取单个 source 的余额明细
- `GET /api/assets/sources/:id/positions`
  - 按需分页读取单个 source 的 DeFi / 结构化仓位

### 12.3 Asset Sync API

- `POST /api/assets/sync`
  - 同步当前用户全部 `ACTIVE`、`FAILED`、`PENDING` 资产来源
- `POST /api/assets/sources/:id/sync`
  - 同步当前用户指定资产来源

### 12.4 Asset Snapshots API

- `GET /api/assets/snapshots`
  - 查询当前用户资产快照趋势
  - 支持 `days`、`startDate`、`endDate`
  - 默认 `days=30`
- `POST /api/assets/snapshots`
  - 手动捕获当前用户资产快照

### 12.5 Manual Assets API

- `GET /api/assets/manual`
  - 支持 `limit`、`offset`、`type` 和 `q`
- `POST /api/assets/manual`
  - 新增当前用户手动资产
  - 保存后捕获当前用户资产快照
- `PATCH /api/assets/manual/:id`
  - 更新当前用户手动资产
  - 保存后捕获当前用户资产快照
- `DELETE /api/assets/manual/:id`
  - 软删除当前用户手动资产
  - 删除后捕获当前用户资产快照

### 12.6 Balances / Positions API

- `GET /api/assets/balances`
  - 支持 `limit`、`offset`、`sourceId`、`sourceType`、`category`、`q`、`sort`
  - 默认按 `valueUsd desc` 返回

- `GET /api/assets/positions`
  - 支持 `limit`、`offset`、`sourceId`、`chain`、`protocol`、`positionType`、`sort`
  - 默认按 `netValueUsd desc` 返回

### 12.7 Health API

- `GET /api/assets/health`
  - 返回失败来源和最近同步日志
  - 支持 `limit`、`sourceId`、`status`
  - 不返回敏感配置、外部完整错误或 API 签名 payload

### 12.8 Cron API

- `GET /api/cron/assets/sync`
  - 批量同步所有启用资产来源
  - 使用 `CRON_SECRET` 鉴权
  - 写入 `scheduled_job_logs`
  - 捕获资产快照时包含用户当前未删除的手动资产

## 13. 同步流程

### 13.1 添加资产来源并首次同步

1. 用户提交资产来源
2. API 调用 `requireSession()`
3. 校验 provider 和配置
4. CEX 配置加密保存；On-chain 地址明文保存到 `public_ref`
5. 创建 `PENDING` source
6. 调用 adapter 拉取 balances 和 positions
7. 成功时覆盖该 source 的当前余额和仓位
8. 失败时记录错误摘要
9. 更新 source 状态、`last_synced_at`、`last_error`
10. 写入 sync log
11. 合并当前用户未删除的手动资产
12. upsert 今日 `asset_snapshots`
13. 返回最新 source 和 summary

### 13.2 单来源同步

1. 校验 session
2. 按 `source_id + user_id` 读取来源
3. 解密配置或读取地址
4. 调用 adapter
5. 用本次结果覆盖该来源当前余额和仓位
6. 更新 source 状态、`last_synced_at`、`last_error`
7. 写入 sync log
8. 捕获用户资产快照

### 13.3 手动资产写入

1. 校验 session
2. 按 `user_id` 创建、更新或软删除手动资产
3. 校验 `amount >= 0` 且 `value_usd >= 0`
4. 重新汇总当前自动余额、结构化仓位和未删除手动资产
5. 捕获用户资产快照
6. 返回最新 summary

### 13.4 Cron 批量同步

1. 校验 `CRON_SECRET`
2. 查询 `status in ('ACTIVE', 'FAILED', 'PENDING')` 的资产来源
3. 按 source 顺序逐个同步
4. 单个 source 失败时记录失败状态和 sync log
5. 每个受影响用户同步结束后捕获资产快照
6. 写入 `scheduled_job_logs`

## 14. Cron 配置

当前 `wrangler.jsonc` 已有：

- `0 */12 * * *` -> `/api/cron/snapshots`
- `0 */4 * * *` -> `/api/cron/assets/sync`
- `0 2 * * *` -> `/api/cron/investments/expiry-reminders`
- `0 14 * * *` -> `/api/cron/investments/expiry-reminders`

`custom-worker.js` 中维护同样映射。

Cloudflare Cron 使用 UTC。`0 */4 * * *` 表示每天 00:00、04:00、08:00、12:00、16:00、20:00 UTC 执行。

## 15. 安全设计

### 15.1 API Key 存储

CEX API Key、Secret、Passphrase 加密存储。

生产环境变量：

- `ASSET_CREDENTIAL_ENCRYPTION_KEY`

要求：

- 使用强随机密钥
- 不提交到仓库
- 通过 Cloudflare Secrets 配置
- 本地开发只用测试 key

当前实现：

- Node `crypto`
- AES-256-GCM
- 每条配置使用独立 IV
- 存储密文、IV、auth tag 和版本号
- 支持 `base64:`、`hex:` 或长 passphrase
- 日志中不应输出明文凭据

### 15.2 只读权限

产品和 UI 明确提示：

- 只使用 read-only API Key
- 不需要交易权限
- 不需要提现权限
- 不需要钱包私钥或助记词

服务端不实现任何交易、划转或签名 API。

### 15.3 错误与日志

- `last_error` 只保存摘要，不保存完整外部请求或 secret
- 交易所签名 payload 不进入日志
- sync log 记录 provider、状态、耗时、数量和错误摘要
- 手动资产备注不进入 sync log 或 scheduled job log
- API 响应不返回 encrypted config

## 16. 环境变量

Assets 相关必需变量：

- `ASSET_CREDENTIAL_ENCRYPTION_KEY`

On-chain provider：

- `OKX_WEB3_API_KEY`
- `OKX_WEB3_API_SECRET`
- `OKX_WEB3_PASSPHRASE`
- `OKX_WEB3_PROJECT_ID`

通用必需变量仍包括：

- `AUTH_SECRET`
- `CRON_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

数据库连接至少需要一种：

- `HYPERDRIVE` binding
- `DATABASE_URL`

后续接入更多 provider 时可增加：

- `ALCHEMY_API_KEY`
- `HELIUS_API_KEY`
- `BLOCKPI_API_KEY`
- `COVALENT_API_KEY`
- `ZAPPER_API_KEY`

## 17. 与现有系统关系

| 模块 | 作用 | 数据来源 | 是否自动同步 |
| --- | --- | --- | --- |
| Investment | 手动收益记录、APR、收益、到期 | 用户手动录入 | 投资快照和自动结算 |
| Assets | 资产聚合、余额、分布、趋势 | CEX API / OKX Web3 / 手动资产 | CEX 和链上周期性同步；手动资产按用户编辑采集 |

当前关系：

- 两套表独立
- 两套 API 独立
- Dashboard 不依赖 Assets
- Analytics 不混合 Assets
- Investment 的手动收益记录和 Assets 的手动资产不是同一类数据；前者描述收益产品，后者描述资产净值

后续融合方向：

- Dashboard 展示总资产和活跃投资本金占比
- Analytics 增加资产净值曲线
- Investment 可从 Assets 中关联某个来源或仓位
- 手动资产可作为“现金 / 备用金 / 其他净值”参与总资产与投资本金对比

## 18. 非功能需求

- 页面兼容桌面和移动端
- 首屏只请求 `/api/assets/summary` 这类轻量接口，避免一次性拉取完整资产详情
- 详情数据按 tab、展开项或分页按需请求
- 长列表接口支持 `limit` 和 `offset`，默认限制为 20 条，最大 50 条
- 趋势接口默认限制时间范围，不默认返回全部历史
- 同步任务可重复执行，不因单个 source 失败中断全局任务
- 单用户资产来源上限为 10 个
- 单用户手动资产上限为 50 个
- 手动资产新增、编辑、删除后立即重新采集当前资产快照
- 数据刷新后 UI 显示最新同步时间
- 同步成功后优先刷新 summary；已打开的详情区再按需刷新
- 汇率展示复用现有显示币种偏好和 `/api/exchange-rate`
- 所有数据库写入使用参数化 SQL
- 所有用户数据 API 必须按 `userId` 过滤
- 游客模式使用 preview 数据，不执行真实同步

## 19. 风险与注意事项

### 19.1 外部 API 限制

- 交易所 API rate limit 不一致
- OKX Web3 API 需要 API key / secret / passphrase，可能受额度和 rate limit 限制
- 不同 provider 的 Earn / DeFi 仓位覆盖率不同
- Cloudflare egress 到部分交易所 API 可能受网络或地域策略影响，当前提供 `/api/diagnostics/egress` 辅助诊断

### 19.2 数据口径不一致

- 交易所和链上聚合服务的估值时间点不同
- 稳定币、低流动性 token、LP token 的估值可能不准确
- DeFi 仓位可能包含借贷、抵押、奖励、负债，当前统一采用净值口径
- 手动资产完全依赖用户录入的美元本位数量，可能与市场价格脱节
- 手动资产的“金额”和“美元本位数量”可能不是同一单位，UI 需要文案说明

### 19.3 安全风险

- 用户可能误创建带交易权限的 API Key
- 错误日志可能泄露外部 API 响应中的敏感信息
- 加密密钥轮换需要额外设计
- 手动资产备注可能包含用户隐私信息，不能进入日志或公开导出

### 19.4 Cloudflare Workers 约束

- Worker 执行时间和外部请求数量有限
- 批量同步需要避免一次 Cron 处理过多 source
- 大规模用户后需要分页、分片或队列化

## 20. 后续建议

近期建议：

- 为手动同步增加服务端节流
- 为 CEX raw data 和 external errors 增加敏感字段过滤
- 为 `lib/assets/service.ts` 和 adapters 增加测试
- 为资产 Cron 增加分页或批次处理
- 明确 source 删除是否需要软删除
- 增加 Assets 同步偏好和 provider 配额配置

第二阶段：

- CEX Earn / 理财 / staking 明细增强
- 其他 portfolio provider fallback
- 更多异构链资产来源
- sync logs 页面化和更细粒度健康诊断
- 资产来源展开详情和分页加载

第三阶段：

- Investment 和 Assets 融合分析
- 多钱包批量导入
- NFT 或税务报表
- 加密密钥轮换和凭据重新加密流程
