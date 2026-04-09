# CeFi & DeFi 投资管理系统技术方案

## 1. 文档目的

本文档基于当前 PRD，输出该 Web 应用的技术实现方案，覆盖整体架构、双存储模式、前端页面组织、数据库设计、权限模型、图表方案、每日任务、部署方案与开发建议，作为研发落地的技术基线。

---

## 2. 技术目标

系统需要满足以下要求：

* 使用 **Next.js** 作为前后端一体化框架
* 支持 **用户系统** 与 **管理员系统**
* 支持投资数据的 **增删改查、收益统计、历史记录管理、图表分析**
* 支持 **本地模式** 与 **远程模式** 两套数据运行机制
* 对未授权用户仅开放查看能力
* 图表采用更贴近币圈产品风格、基于 React 的专业图表库
* 数据库选型需适合 Node.js / Next.js 生态，且易于后续扩展

---

## 3. 总体技术架构

采用 **Next.js 全栈架构**，前端页面、服务端接口、鉴权逻辑、后台管理能力统一在一个项目中实现。

本次方案新增 **双存储模式架构**：

* **本地模式（Local Mode）**：数据仅存储于浏览器 IndexedDB，本地运行，不依赖服务端数据库，不启用每日任务
* **远程模式（Remote Mode）**：数据存储于服务端数据库，由服务端执行每日任务并生成分析数据

### 3.1 架构模式

* 前端：Next.js App Router + React + TypeScript
* 服务端：Next.js Route Handlers / Server Actions
* 鉴权：NextAuth.js（Auth.js）
* ORM：Prisma
* 数据库：SQLite
* 本地存储：IndexedDB
* UI：Ant Design
* 图表：TradingView Lightweight Charts React 封装
* 缓存与限流：Redis（可选增强）
* 定时任务：Cron / Vercel Cron / 自托管 Scheduler

### 3.2 双存储模式架构说明

#### 本地模式

* 数据保存在浏览器 IndexedDB
* 前端直接读取本地数据并计算 Dashboard 当前指标
* 不调用远程投资 CRUD 接口
* 不写入服务端快照数据
* 不运行每日任务
* Analysis 页面不可用

#### 远程模式

* 数据存储在服务端 SQLite
* 用户登录后使用服务端接口进行 CRUD
* 服务端每日执行任务，生成投资快照和组合快照
* 支持 Analysis 页面、APR 趋势图、历史收益图
* 支持管理员与权限控制

### 3.3 为什么选择 Next.js

Next.js 适合本项目的原因：

* 前后端统一，研发效率高
* App Router 天然支持服务端渲染与服务端鉴权
* 适合 Dashboard、表格、后台管理等 B 端风格系统
* API 与页面同仓库维护，便于权限控制与部署
* 容易扩展为 SaaS 或多用户系统
* 适合同时承载本地模式和远程模式的统一前端壳层

---

## 4. 技术栈选型

## 4.1 前端技术栈

* **Next.js 15+**
* **React 19+ / React 18 稳定版**
* **TypeScript**
* **Ant Design**
* **TanStack Query**（远程模式数据请求与缓存）
* **Zustand**（轻量级全局状态管理）
* **dayjs**（日期处理）
* **react-hook-form + zod**（表单与校验）
* **Dexie.js**（IndexedDB 封装，推荐）

### 选型说明

Ant Design 非常适合你的系统，因为你这个产品核心是：

* 大量表格
* 表单录入
* 弹窗确认
* 筛选器
* 后台管理视图

这类场景 antd 的成熟度明显高于偏营销型 UI 库。

本地模式建议使用 **Dexie.js** 封装 IndexedDB，原因是：

* API 比原生 IndexedDB 易用很多
* 在 React 项目中维护本地数据更稳定
* 后续做本地查询、版本迁移和导入导出更方便

---

## 4.2 图表库选型

推荐使用：

**TradingView Lightweight Charts + React 封装**

推荐原因：

* TradingView 风格在币圈产品中认知度非常高
* 对收益曲线、APR 曲线、资产变化曲线的展示非常贴合
* 交互体验成熟，适合时间序列数据
* 基于 React 使用成本可控
* 视觉上比通用报表图更接近交易、资产和投资产品

### 技术实现建议

优先方案：

* `lightweight-charts`
* 自定义封装 React 组件，或使用成熟 React wrapper

适用图表：

* 总收益曲线
* 历史收益曲线
* 单项目收益趋势
* APR 时间变化曲线

---

## 4.3 后端技术栈

* **Next.js Route Handlers**：实现 RESTful API
* **Server Actions**：用于部分后台写操作
* **Prisma ORM**：数据库访问层
* **Zod**：请求参数校验
* **bcrypt / argon2**：密码加密
* **NextAuth.js / Auth.js**：登录鉴权

---

## 4.4 数据库选型推荐

推荐数据库：**SQLite**

### 推荐原因

SQLite 是当前这个项目更合适的数据库，原因如下：

1. 与 Node.js / Prisma 集成简单，开发与部署成本低
2. 单文件数据库，适合当前单机部署与 MVP 快速迭代
3. 足以支撑投资记录、收益快照、操作日志这类中后台场景
4. 便于本地开发、备份和迁移
5. 后续若业务规模扩大，仍可再迁移到更强的服务端数据库
6. 更符合当前“服务端单实例 + 本地模式”的落地策略

### ORM 选型

推荐：**Prisma**

原因：

* 和 Next.js 集成顺滑
* 类型安全
* schema 清晰
* 迁移管理方便
* 非常适合中后台系统

---

## 5. 系统角色与权限方案

系统至少包含三类角色：

### 5.1 角色定义

1. **游客 / 未登录用户**

   * 可查看公开页面
   * 可使用本地模式基础能力（按产品策略开放）
   * 不可操作远程私有数据

2. **普通用户**

   * 可查看自己的投资记录、历史收益、统计图表
   * 可对自己的数据执行新增、编辑、删除、提前结束
   * 可切换数据存储模式
   * 不可操作他人数据

3. **管理员**

   * 可查看全部用户数据
   * 可管理所有投资记录
   * 可管理用户账号、角色、状态
   * 可审计删除记录与关键变更记录
   * 可查看每日任务日志并手动重跑任务

### 5.2 权限原则

采用 **RBAC（基于角色的权限控制） + 数据归属控制**。

权限判断分两层：

* 第一层：角色权限
* 第二层：资源归属校验

### 5.3 关键权限规则

* 只有记录 owner 或管理员能增删改查远程私有数据
* 非 owner 非管理员，只允许查看公开内容
* 删除历史记录必须校验 owner/admin 身份
* 批量操作同样必须逐条校验权限
* 本地模式数据仅存在浏览器，不进入管理员管控范围

---

## 6. 用户系统设计

## 6.1 登录方式

建议第一阶段支持：

* 邮箱 + 密码登录

后续可扩展：

* Google 登录
* GitHub 登录
* Web3 Wallet 登录（如 SIWE）

## 6.2 鉴权方案

推荐使用：**NextAuth.js（Auth.js）**

实现方式：

* Credentials Provider 用于邮箱密码登录
* Session 基于 JWT 或数据库 Session
* 在 middleware 中对页面级权限做拦截
* 在 API 层再做一次服务端校验

### 模式关联说明

* **本地模式**：可支持未登录使用基础功能
* **远程模式**：必须登录，所有数据归属到用户账号
* 当用户在个人中心切换到远程模式时，若未登录，则必须先完成登录

### 6.3 用户状态

用户表建议包含：

* ACTIVE
* DISABLED
* PENDING

管理员可对用户执行：

* 查看
* 禁用
* 启用
* 修改角色

---

## 7. 功能模块技术设计

## 7.0 核心前端页面结构

当前版本前端聚焦 4 个核心页面：

### 7.0.1 Dashboard 页面

定位：主工作台，用于查看当前投资状态与进行日常操作。

#### 页面模块

* 顶部概览卡片

  * 总投入
  * 当前累计收益
  * 当前每日收益
  * 当前每周收益
  * 当前每月收益
  * 当前每年收益
  * 当前综合 APR
* 投资记录表格
* 快捷操作区（新增、编辑、提前结束、删除）
* 模式状态提示（当前为本地模式 / 远程模式）

#### 技术建议

* 使用 `antd Layout + Card + Statistic + Table + Tag`
* 数据来源：

  * 本地模式：IndexedDB + 本地计算
  * 远程模式：API + 服务端返回

### 7.0.2 Analysis 页面

定位：分析页，用于展示历史收益、APR 趋势和图表结果。

#### 页面模块

* 时间区间筛选器
* 综合 APR 趋势图
* 每日收益趋势图
* 累计收益趋势图
* 单项目收益趋势图
* 预期 APR vs 实际 APR 偏差图

#### 模式规则

* 本地模式下页面不可用
* 页面展示 Empty 状态 + 模式提示 + 跳转设置页入口
* 远程模式下通过快照数据正常展示

### 7.0.3 登录 / 注册页面

定位：身份认证入口。

#### 页面模块

* 登录 Tab
* 注册 Tab
* 邮箱 / 密码 / 确认密码
* 登录后跳转 Dashboard
* 未登录时可先体验本地模式

### 7.0.4 个人中心 / 设置页面

定位：用户账号和系统设置中心。

#### 页面模块

* 用户资料
* 修改密码
* 当前角色与账号状态
* 数据存储模式设置
* 本地模式 / 远程模式说明
* 数据迁移提示
* 登出

#### 关键设置项：数据存储模式

* Local Mode
* Remote Mode

切换逻辑：

* 切换到远程模式：未登录则要求先登录
* 切换到本地模式：提示 Analysis 与每日任务能力将不可用

---

## 7.1 投资面板模块

### 功能

* 投资记录表格展示
* 多条件筛选
* 搜索
* 排序
* 分页
* 新增 / 编辑 / 删除 / 提前结束

### 前端实现

* 使用 antd `Table`
* 表头支持排序与筛选
* 右侧操作列使用 Dropdown / Button
* 新增与编辑使用 `Modal + Form`
* 删除使用 `Modal.confirm`
* 通过模式适配层决定数据来源：

  * 本地模式：操作 IndexedDB
  * 远程模式：调用 API

### 后端实现

提供接口：

* `GET /api/investments`
* `POST /api/investments`
* `PATCH /api/investments/:id`
* `DELETE /api/investments/:id`
* `POST /api/investments/:id/early-close`

### 权限校验

* 查询接口默认只返回当前用户数据
* 管理员可通过 query 参数查看全部或按用户筛选
* 修改、删除、提前结束都必须校验 owner/admin

---

## 7.2 历史收益模块

### 功能

* 查看已结束投资记录
* 查看实际 APR / 最终收益 / 持有周期
* 删除历史记录（带二次确认）

### 技术建议

不要单独物理拆表存“历史表”，而是优先采用：

* 同一张 investment 表
* 用 `status = ENDED / EARLY_ENDED`
* 历史收益页面按状态过滤

这样可以降低模型复杂度，避免当前数据与历史数据重复同步。

---

## 7.3 收益统计模块

### 功能

* 当前每日收益
* 当前每周收益
* 当前每月收益
* 当前每年收益
* 区间总收益
* 历史累计收益

### 技术实现思路

收益可以分为两层：

#### A. 本地模式：实时派生字段

基于当前 IndexedDB 中的 investment 数据实时计算：

* daily_income
* weekly_income
* monthly_income
* yearly_income

适合 Dashboard 页面快速展示。

#### B. 远程模式：快照表 + 实时聚合

为了支持历史曲线、历史统计，远程模式引入收益快照表。

表名建议：`income_snapshots`

字段：

* id
* user_id
* investment_id
* snapshot_date
* daily_income
* cumulative_income
* apr_actual
* principal
* created_at

### 快照生成方式

仅远程模式执行每日定时任务：

* 遍历进行中的投资
* 按规则计算当日收益
* 写入快照表
* 用于图表和历史回溯

### 模式差异总结

* 本地模式：只支持“当前收益”计算，不支持历史分析
* 远程模式：支持“当前收益 + 历史收益 + 趋势分析”

---

## 7.4 APR 分析模块

### 指标

* 当前平均预期 APR
* 当前平均实际 APR
* 各项目 APR 分布
* 时间区间 APR 变化
* 实际 APR 与预期 APR 偏差

### 技术实现

* Dashboard 展示当前综合 APR
* Analysis 页按时间区间查询快照表
* 用聚合 SQL + Prisma 查询实现
* 本地模式不开放 Analysis 结果

---

## 7.5 删除机制

### 删除需求

* 支持删除当前投资记录
* 支持删除历史记录
* 删除必须二次确认

### 技术设计

远程模式推荐 **软删除**：

* `is_deleted = true`
* `deleted_at`
* `deleted_by`

本地模式推荐：

* 逻辑删除或本地回收站（后续可选）
* MVP 也可直接本地删除，但前端仍保留二次确认

### 前端交互

* 第一次点击删除：弹窗确认
* 展示：项目名、金额、时间
* 第二次确认：按钮确认
* 可选增强：输入 `DELETE`

---

## 8. 数据库设计

## 8.1 远程模式核心表设计

### users

```sql
id
email
password_hash
name
role
status
storage_mode
created_at
updated_at
```

### investments

```sql
id
user_id
project
name
url
type
amount
currency
position_note
apr_expected
apr_actual
income_total
income_daily
income_weekly
income_monthly
income_yearly
start_time
end_time
holding_days
status
remark
is_deleted
deleted_at
deleted_by
created_at
updated_at
```

### investment_daily_snapshots

```sql
id
user_id
investment_id
snapshot_date
principal
apr_expected
apr_actual
income_daily
income_weekly
income_monthly
income_yearly
income_total
status
created_at
```

### portfolio_daily_snapshots

```sql
id
user_id
snapshot_date
total_principal
portfolio_apr_expected
portfolio_apr_actual
total_income_daily
total_income_weekly
total_income_monthly
total_income_yearly
cumulative_income
active_investment_count
created_at
```

### operation_logs

```sql
id
user_id
target_type
target_id
action
before_data
after_data
created_at
ip
user_agent
```

### scheduled_job_logs

```sql
id
job_name
run_date
status
processed_count
duration_ms
error_message
started_at
finished_at
created_at
```

## 8.2 本地模式数据结构建议

本地模式不走服务端 SQLite，而是走 IndexedDB。

建议本地表结构映射为：

* investments
* settings
* local_meta

通过 Dexie schema 管理版本升级。

---

## 9. API 设计建议

## 9.1 用户相关

* `POST /api/auth/register`
* `POST /api/auth/login`
* `POST /api/auth/logout`
* `GET /api/me`

## 9.2 投资记录（仅远程模式）

* `GET /api/investments`
* `GET /api/investments/:id`
* `POST /api/investments`
* `PATCH /api/investments/:id`
* `DELETE /api/investments/:id`
* `POST /api/investments/:id/early-close`

## 9.3 收益与图表（仅远程模式）

* `GET /api/income/summary`
* `GET /api/income/timeseries`
* `GET /api/apr/summary`
* `GET /api/history/investments`

## 9.4 数据模式与同步

* `GET /api/settings/storage-mode`
* `PATCH /api/settings/storage-mode`
* `POST /api/sync/local-to-remote`

## 9.5 管理员接口

* `GET /api/admin/users`
* `PATCH /api/admin/users/:id/role`
* `PATCH /api/admin/users/:id/status`
* `GET /api/admin/logs`
* `GET /api/admin/investments`
* `GET /api/admin/jobs`
* `POST /api/admin/jobs/retry`

---

## 10. 前端页面设计

## 10.1 页面结构

### 核心页面

* 登录 / 注册页
* Dashboard 页
* Analysis 页
* 个人中心 / 设置页

### 管理后台

* 用户管理页
* 投资记录总览页
* 操作日志页
* 任务中心页

## 10.2 Dashboard 首页内容

* 总投入
* 总累计收益
* 当前每日收益
* 当前每周收益
* 当前每月收益
* 当前每年收益
* 当前综合 APR
* 当前投资表
* 当前模式状态

## 10.3 Analysis 页面内容

* 综合 APR 趋势图
* 每日收益趋势图
* 累计收益趋势图
* 单项目收益趋势图
* APR 偏差分析图
* 模式不可用提示（本地模式）

## 10.4 设置页内容

* 用户信息
* 修改密码
* 数据存储模式
* 数据迁移入口
* 模式说明

## 10.5 组件建议

* `antd Layout`
* `antd Table`
* `antd Card`
* `antd Statistic`
* `antd DatePicker`
* `antd Modal`
* `antd Form`
* `antd Tabs`
* `antd Tag`
* `antd Empty`
* `antd Segmented`

---

## 11. 双存储模式、收益计算、每日任务与任务调度

## 11.0 双存储模式技术设计

### 本地模式实现

* 浏览器本地使用 IndexedDB 存储 investment 数据
* 推荐通过 Dexie.js 封装数据访问层
* Dashboard 页通过本地 service 直接读取数据并计算当前收益
* Analysis 页直接置灰或返回不可用状态
* 不调用服务端每日任务相关接口

### 远程模式实现

* 数据存储在服务端 SQLite
* 所有写操作走服务端 API
* 每日任务仅在服务端对远程用户数据运行
* Analysis 页基于快照表读取结果

### 模式适配层建议

前端增加统一数据访问层：

```ts
investmentRepository
  - getList()
  - create()
  - update()
  - delete()
```

底层根据 storageMode 自动切换：

* localInvestmentRepository
* remoteInvestmentRepository

这样可以避免页面层写两套逻辑。

## 11.1 收益计算策略

系统需要同时支持两种模式：

### 模式一：自动计算

按公式推导：

* 日收益 = 本金 × APR / 365
* 周收益 = 日收益 × 7
* 月收益 = 日收益 × 30
* 年收益 = 本金 × APR

### 模式二：手动覆盖

考虑到 DeFi 和 CeFi 的收益常常不是严格固定，允许用户手动录入：

* 实际 APR
* 实际累计收益
* 提前结束时最终收益

最终以前端展示值优先读取“人工修正值”，没有则读取系统计算值。

## 11.2 每日任务系统（仅远程模式）

系统需要内置一个 **Daily Jobs（日常任务系统）**，用于每日定时采集、计算、汇总和生成分析结果。

### 目标

每日自动运行多个任务，形成“当日投资快照”，为收益统计、APR 分析和历史图表提供基础数据。

注意：

* 仅远程模式用户进入该任务流程
* 本地模式用户不参与任何服务端每日任务

### 每日任务主流程

1. 拉取当前有效投资记录
2. 计算或采集每条投资的当日 APR
3. 计算每条投资的当日收益
4. 计算全账户综合 APR
5. 生成当日收益汇总
6. 写入每日快照表
7. 刷新图表数据缓存或预聚合结果
8. 记录任务日志

### 每日任务拆分设计

* Job 1：投资记录扫描
* Job 2：每日 APR 采集
* Job 3：每日收益采集与计算
* Job 4：综合 APR 聚合
* Job 5：每日收益汇总
* Job 6：图表数据预聚合
* Job 7：任务日志与告警

### 综合 APR 推荐计算逻辑

**综合 APR = Σ(单条投资本金 × 单条投资实际 APR) / Σ本金**

## 11.3 图表生成策略

图表数据建议直接基于每日快照表生成。

### 核心图表

1. 综合 APR 日趋势图
2. 每日收益趋势图
3. 累计收益趋势图
4. 单项目收益趋势图
5. APR 偏差分析图

### 图表生成方式

#### 方案 A：查询时动态渲染

* 前端调用 API 获取时序数据
* 使用 TradingView Lightweight Charts 渲染

#### 方案 B：预聚合图表数据

* 每日任务执行后同步写入图表数据表或缓存
* 前端直接读取结构化序列

MVP 阶段建议先采用方案 A。

## 11.4 任务调度实现建议

### MVP 阶段

* 使用 `node-cron` 或平台 Cron
* 每日执行一次主任务入口
* 在主任务中串行或分步骤执行多个 job

### 进阶阶段

* 使用 `BullMQ + Redis`
* 支持失败重试、并发控制、任务监控

### API / Cron 入口建议

* `POST /api/internal/jobs/daily`

要求：

* 仅服务端可调用
* 需校验内部密钥或 Cron Secret
* 不对普通用户开放

## 11.5 一致性与幂等设计

对以下维度增加唯一约束：

* `investment_id + snapshot_date`
* `user_id + snapshot_date`
* `job_name + run_date`

支持管理员手动重跑某日任务。

---

## 12. 安全设计

## 12.1 认证安全

* 密码使用 argon2 或 bcrypt 哈希
* 所有敏感接口必须校验 session
* 后端写接口统一做角色与 owner 校验

## 12.2 数据安全

* 远程模式采用软删除避免误删
* 操作日志记录重要变更
* 管理员操作必须留痕
* 本地模式下提示用户浏览器数据清理风险

## 12.3 接口安全

* 请求体使用 zod 校验
* 限流防刷
* 关键删除接口增加 CSRF / 二次确认防护
* 内部任务接口使用 Cron Secret

---

## 13. 部署方案

## 13.1 推荐部署组合

### 方案 A：快速上线

* Next.js：自托管 Node.js / Docker
* SQLite：挂载持久化磁盘
* Prisma：直接连接 SQLite 文件
* 定时任务：系统 Cron / 平台 Scheduler

### 方案 B：自托管

* Next.js：Docker + PM2 / Node Runtime
* SQLite：应用同机持久化存储
* Redis：缓存与队列
* Nginx：反向代理
* Cron Worker：独立服务

### 推荐意见

如果你先做 MVP，推荐：

* **单台服务器 + SQLite + Prisma**

这样开发和上线都最快。

### 本地模式补充说明

* 本地模式不依赖后端数据库即可运行前端基础能力
* 但正式部署时仍建议保留后端服务，以支持登录、远程模式和后续升级

---

## 14. 项目目录建议

```bash
src/
  app/
    (public)/
      login/
      register/
    (dashboard)/
      dashboard/
      analysis/
      settings/
    admin/
    api/
  components/
    charts/
    tables/
    forms/
    layout/
    mode/
  lib/
    auth/
    prisma/
    permissions/
    calculators/
    validators/
    storage/
      dexie/
      repositories/
  services/
    jobs/
    sync/
  hooks/
  store/
  types/
prisma/
  schema.prisma
```

---

## 15. 开发阶段建议

## 第一阶段：MVP

* 登录 / 注册
* Dashboard 页面
* 设置页面
* 本地模式（IndexedDB）
* 远程模式（数据库）
* 投资记录 CRUD
* 权限控制
* 当前日/周/月/年收益展示
* 删除二次确认

## 第二阶段：增强版

* Analysis 页面
* 收益曲线
* 历史快照
* 每日任务
* APR 分析
* 数据迁移（本地到远程）
* 管理员后台
* 操作日志
* 任务中心

## 第三阶段：高级版

* 自动同步交易所数据
* 链上地址解析
* Web3 登录
* 多账户体系

---

## 16. 最终推荐结论

本项目推荐采用以下核心技术组合：

* **框架：Next.js**
* **前端：React + TypeScript + Ant Design**
* **本地存储：IndexedDB + Dexie.js**
* **后端：Next.js Route Handlers + Server Actions**
* **鉴权：NextAuth.js（Auth.js）**
* **数据库：SQLite**
* **ORM：Prisma**
* **图表：TradingView Lightweight Charts（React 封装）**
* **部署：单机 / Docker 自托管**

这是当前最适合你这个系统的方案，因为它同时满足：

* 开发效率高
* Node.js 生态成熟
* 对表格、权限、图表、统计场景友好
* 同时兼容本地隐私模式和远程分析模式
* 容易扩展成正式产品

---

## 17. 附：一句话架构总结

这是一个基于 **Next.js 全栈 + SQLite + Prisma + Auth.js + antd + TradingView Lightweight Charts** 的多用户投资管理系统，同时支持 **本地 IndexedDB 模式** 与 **远程数据库模式**：本地模式用于轻量和隐私场景，远程模式用于服务端每日任务、APR 快照、历史收益分析和管理员管控。

（完）
