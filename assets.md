# Assets 模块 PRD（assets.md）

## 1. 模块定位

Assets 模块用于**自动聚合用户在多个数据源（CEX / On-chain）的资产情况**，并以只读方式展示用户的总资产、仓位分布及变化趋势。

该模块是对现有“手动记录 Investment”的补充，侧重：

* 自动化资产读取（无需手动录入）
* 全资产视角（非收益视角）
* 多平台统一展示

⚠️ 不涉及交易、授权签名或资金操作，仅为**数据读取与展示模块**

---

## 2. 产品目标

### 2.1 核心目标

* 聚合用户多平台资产形成“总资产视图”
* 提供资产分布与变化趋势
* 降低用户手动维护资产成本

### 2.2 非目标

* 不支持交易执行
* 不支持资产划转
* 不做实时高频更新（采用周期性同步）
* 不替代 Investment 收益分析模块

---

## 3. 核心使用场景

### 3.1 添加资产来源

用户可以添加两类资产来源：

#### 1）CEX（中心化交易所）

用户输入：

* 交易所（预置）
* API Key
* API Secret
* （可选）Passphrase

系统通过交易所 API 读取：

* 账户总余额
* 各币种资产
* 理财/earn 产品仓位（如支持）

支持交易所（首批）：

* OKX
* Binance
* Bybit
* Bitget
* Gate
* HTX
* KuCoin

---

#### 2）On-chain（链上地址）

用户输入：

* 链类型：

  * EVM
  * Solana
  * Sui
  * All（自动识别）
* 钱包地址

系统通过第三方服务（如 DeBank / Covalent / Zapper）读取：

* Token 余额
* DeFi 仓位（LP / Lending / Staking）

---

### 3.2 查看资产总览

用户在 `/assets` 页面可查看：

* 总资产（统一计价）
* 各资产来源合计
* 资产分布
* 历史变化趋势

---

### 3.3 自动同步资产

系统每 4 小时执行一次：

* 拉取所有资产源最新数据
* 更新用户资产 snapshot
* 写入历史记录

---

## 4. 信息架构

新增页面：

### 4.1 Assets `/assets`

放置在 Dashboard 之后

页面结构：

1. 总资产卡片
2. 资产趋势图（总资产变化）
3. 资产分布图（按币种 / 按平台）
4. 资产来源列表
5. 仓位明细列表
6. 「新增资产源」按钮

---

## 5. UI 设计

### 5.1 风格

* 延续 Dashboard（Tailwind + Radix UI） 
* 图表使用 Recharts（与 Analytics 保持一致） 

---

### 5.2 核心组件

#### 1）总资产卡片

* 总资产（USD / 用户选择币种）
* 24h 变化（可选）
* 数据更新时间

---

#### 2）资产趋势图

* 折线图
* 数据来源：资产 snapshot

---

#### 3）资产分布图

* 饼图 / 堆叠图
* 维度：

  * 币种
  * 平台（CEX / On-chain）

---

#### 4）资产来源列表

字段：

* 名称（Binance / 钱包地址）
* 类型（CEX / On-chain）
* 状态（正常 / 失败）
* 上次同步时间
* 操作（刷新 / 删除）

---

#### 5）仓位明细

字段：

* 资产名称
* 数量
* 价值（USD）
* 来源（交易所 / 链）
* 类型（Spot / Earn / DeFi）

---

## 6. 关键业务对象

### 6.1 AssetSource

资产来源

```
- id
- userId
- type: CEX | ONCHAIN
- name
- config (加密存储)
- status
- lastSyncedAt
- createdAt
```

---

### 6.2 AssetBalance

资产余额

```
- id
- userId
- sourceId
- assetSymbol
- amount
- valueUsd
- category (spot / earn / defi)
- updatedAt
```

---

### 6.3 AssetSnapshot

资产快照（用于趋势）

```
- id
- userId
- totalValueUsd
- breakdown (json)
- createdAt
```

---

## 7. 业务流程

### 7.1 添加资产源

1. 用户点击「新增资产源」
2. 输入 APIKey / 地址
3. 后端验证连接
4. 成功后立即拉取一次数据
5. 写入 AssetBalance + Snapshot

---

### 7.2 定时同步（核心）

基于现有 Cron 机制扩展： 

新增任务：

```
/api/cron/assets/sync
```

执行逻辑：

1. 遍历所有用户 AssetSource
2. 调用对应 adapter：

   * cexAdapter
   * onchainAdapter
3. 标准化数据
4. 更新 AssetBalance
5. 生成 AssetSnapshot

执行频率：

* 每 4 小时一次

---

## 8. 技术设计

### 8.1 Adapter 设计

新增目录：

```
lib/assets/adapters/
```

#### CEX Adapter

统一接口：

```
getBalances()
getPositions()
```

按交易所实现：

```
binanceAdapter.ts
okxAdapter.ts
...
```

---

#### On-chain Adapter

通过第三方 API：

推荐：

* DeBank API
* Covalent
* Zapper

统一输出：

```
tokens
defiPositions
totalValue
```

---

### 8.2 数据流

```
API → Adapter → Normalize → DB → Snapshot → UI
```

---

### 8.3 安全设计

* API Key 必须加密存储（AES）
* 不存储交易权限（仅允许 read-only）
* 提示用户仅提供只读 API

---

## 9. API 设计

### 9.1 Assets API

```
GET /api/assets
GET /api/assets/snapshot
POST /api/assets/source
DELETE /api/assets/source/:id
POST /api/assets/sync
```

---

## 10. 与现有系统关系

| 模块         | 作用     |
| ---------- | ------ |
| Investment | 手动收益记录 |
| Assets     | 自动资产聚合 |

两者关系：

* 数据完全独立
* Dashboard 不直接依赖 Assets（初期）
* 后续可做融合（总资产 vs 投资本金）

---

## 11. 非功能需求

* 支持多币种显示（复用现有汇率 API） 
* 同步失败需有容错（标记 source 状态）
* 单用户资产源数量限制（如 ≤ 10）

---

## 12. 风险与注意事项

### 12.1 API 限制

* CEX API rate limit
* 第三方 API 可能收费 / 限流

### 12.2 数据不一致

* 不同平台估值口径不同
* DeFi 仓位解析复杂

---

## 13. 后续扩展方向

* 实时刷新（WebSocket）
* 资产收益分析（与 Investment 融合）
* 多钱包聚合
* NFT 资产支持
* 税务报表

---
