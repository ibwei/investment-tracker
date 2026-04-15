# Earn Compass 测试用例文档

本文档基于当前代码、`README.md`、`prd.md`、`tech.md` 和 `db/schema.sql` 整理。目标是覆盖 Earn Compass 当前真实产品范围：游客只读预览、登录用户远程数据、投资管理、收益分析、资产聚合、认证、Cron、Cloudflare Workers 部署和安全边界。

## 1. 测试范围

### 1.1 覆盖模块

- 认证与账户：邮箱验证码、注册、登录、登出、Session、OAuth、资料更新。
- 游客预览：Dashboard、Assets、Analytics、Settings 的只读体验。
- 投资管理：新增、编辑、结束、删除、清空、筛选、排序、收益计算。
- Analytics：组合快照、趋势图、手动捕获快照、边界日期查询。
- Assets：资产总览、来源管理、手动资产、余额、仓位、同步、健康状态、资产快照。
- Cron：投资快照、自动结算、到期提醒、资产同步。
- 国际化、币种、时区：中英文、显示币种、本地时区换算。
- 非功能：响应式、错误反馈、构建、Cloudflare 兼容、性能与安全。

### 1.2 暂不覆盖或只做冒烟

- 找回密码、数据导入、管理员后台、多组合视角：当前未实现。
- 真实链上交易、钱包签名、提现、划转：产品非目标。
- 通知偏好持久化：当前只是前端占位，不作为后端发送策略断言。
- Dexie Local Mode 完整产品路径：代码保留但非当前成熟主路径，仅做隔离与回归冒烟。

## 2. 测试环境和数据

### 2.1 环境要求

- Node.js 与 npm 可运行当前项目。
- 本地或测试 PostgreSQL 已执行 `db/schema.sql`。
- `.env` 指向测试数据库，禁止连接生产数据库。
- `AUTH_SECRET`、`ASSET_CREDENTIAL_ENCRYPTION_KEY`、`CRON_SECRET` 使用测试值。
- Resend、CEX、OKX Web3 等外部服务优先使用 mock、测试账号或代理桩。

### 2.2 推荐测试账号

- `user_a@example.test`：普通登录用户，默认时区 `Asia/Shanghai`。
- `user_b@example.test`：数据隔离验证用户。
- `oauth_existing@example.test`：用于 OAuth 绑定已有邮箱。
- `disabled@example.test`：用于用户状态边界验证。

### 2.3 推荐基础投资数据

- 活跃投资 A：`ONGOING`，金额 1000，APR 12%，开始时间为今天，结束时间为未来 30 天。
- 今日到期投资 B：`ONGOING`，结束时间等于当前时间或当前时间之前。
- 无结束日期投资 C：`ONGOING`，`end_time = null`。
- 已结束投资 D：`ENDED`，有 `income_total`。
- 提前结束投资 E：`EARLY_ENDED`，有 `apr_actual` 和备注。
- 软删除投资 F：`is_deleted = true`。

### 2.4 推荐资产数据

- CEX source：`BINANCE` 或 mock provider，含 API Key/Secret 测试凭据。
- CEX source with passphrase：`OKX`、`BITGET` 或 `KUCOIN`。
- On-chain source：`OKX_WEB3` 或 `AUTO`，使用公开测试地址。
- Manual asset：现金、股票、基金、Token、房产、其他各一条。
- Sync log：成功、失败、部分为空错误信息各一条。

## 3. 优先级定义

- P0：安全、数据隔离、鉴权、核心写入、构建失败会阻断上线。
- P1：核心用户路径、关键业务规则、Cron、资产同步。
- P2：展示、筛选、分页、边界体验、兼容性。
- P3：易用性、文案、视觉和低风险回归。

## 4. 认证与账户测试用例

### AUTH-001 邮箱验证码发送成功

- 优先级：P0
- 前置条件：测试邮箱未注册，Resend 使用 mock 或测试发送服务。
- 步骤：提交 `POST /api/auth/email-verification`，body 包含有效 email。
- 预期结果：返回成功；数据库写入一条 `email_verification_codes`；验证码为 hash，不保存明文；过期时间约为创建后 10 分钟；邮件发送被调用。

### AUTH-002 邮箱验证码发送冷却

- 优先级：P0
- 步骤：同一 email 连续两次请求验证码，间隔小于 60 秒。
- 预期结果：第二次返回 429 或业务错误；不会生成新的可用验证码；错误信息不泄露已有验证码。

### AUTH-003 邮箱验证码格式和归一化

- 优先级：P1
- 测试数据：` USER_A@EXAMPLE.TEST `、`bad-email`、空字符串。
- 预期结果：有效邮箱会 trim 并转小写；非法邮箱返回 400；空邮箱返回 400。

### AUTH-004 注册成功并设置 session

- 优先级：P0
- 前置条件：存在未消费、未过期的注册验证码。
- 步骤：提交 email、password、name、verificationCode。
- 预期结果：创建 `users` 记录；`role = USER`；`status = ACTIVE`；`storage_mode = REMOTE`；`timezone = Asia/Shanghai`；密码为 scrypt hash；响应设置 `earn_compass_session` httpOnly cookie。

### AUTH-005 注册密码长度边界

- 优先级：P0
- 测试数据：7 位、8 位、128 位、包含空格和特殊字符的密码。
- 预期结果：7 位拒绝；8 位及以上接受；密码不会在响应、日志或数据库明文出现。

### AUTH-006 注册验证码错误、过期、已消费

- 优先级：P0
- 步骤：分别使用错误验证码、过期验证码、已消费验证码注册。
- 预期结果：注册失败；不创建用户；验证码消费状态保持正确；错误信息不暴露正确验证码。

### AUTH-007 重复邮箱注册

- 优先级：P0
- 步骤：使用已注册邮箱再次注册。
- 预期结果：返回 409；不会覆盖已有用户资料、密码、OAuth 绑定或 storage mode。

### AUTH-008 登录成功

- 优先级：P0
- 步骤：使用正确 email/password 调用 `POST /api/auth/login`。
- 预期结果：返回当前用户；设置 `earn_compass_session`；cookie 为 `httpOnly`、`sameSite=lax`，生产环境为 `secure`。

### AUTH-009 登录失败安全边界

- 优先级：P0
- 测试数据：不存在邮箱、错误密码、短密码、大小写 email。
- 预期结果：不存在邮箱和错误密码都返回统一错误；不会暴露账号是否存在；短密码按规则拒绝；email 会小写归一化。

### AUTH-010 Session 读取

- 优先级：P0
- 步骤：登录后调用 `GET /api/auth/session`。
- 预期结果：返回用户 id、email、name、role、status、storageMode、timezone；不返回 password hash、session token 或敏感字段。

### AUTH-011 Session 篡改和过期

- 优先级：P0
- 步骤：修改 cookie payload、修改签名、构造过期 `exp`。
- 预期结果：`getSession()` 返回 null；受保护 API 返回 401；不会抛出未处理异常。

### AUTH-012 登出

- 优先级：P0
- 步骤：调用 `POST /api/auth/logout`。
- 预期结果：清除 session cookie；之后访问受保护 API 返回 401；前端回到游客预览模式。

### AUTH-013 更新个人资料

- 优先级：P1
- 步骤：登录后 PATCH `/api/auth/session` 修改 name 和 timezone。
- 预期结果：数据库更新当前用户；无效 timezone 回退或规范化为默认时区；响应不返回敏感字段。

### AUTH-014 禁止修改邮箱

- 优先级：P0
- 步骤：PATCH `/api/auth/session` 携带不同 email。
- 预期结果：返回 400；原邮箱不变；不会创建新用户或 OAuth 账号。

### AUTH-015 OAuth provider 可用性

- 优先级：P1
- 步骤：分别配置和不配置 Google/GitHub env，调用 `GET /api/auth/providers`。
- 预期结果：只将配置完整的 provider 标记可用；响应不返回 client secret。

### AUTH-016 OAuth state 防护

- 优先级：P0
- 步骤：发起 OAuth 后篡改 callback state 或使用错误 provider cookie。
- 预期结果：callback 拒绝；不会创建用户；不会设置 session。

### AUTH-017 OAuth 绑定已有邮箱

- 优先级：P0
- 前置条件：存在 email/password 用户。
- 步骤：OAuth profile 返回同一 email，provider account 尚未绑定。
- 预期结果：绑定到已有用户；不会创建重复用户；`auth_accounts` 唯一约束有效。

## 5. 游客预览与权限测试用例

### GUEST-001 游客访问 Dashboard

- 优先级：P1
- 步骤：无 cookie 访问 `/`。
- 预期结果：加载预览投资；显示预览提示；统计卡和列表可读；不调用真实写 API。

### GUEST-002 游客访问 Analytics

- 优先级：P1
- 步骤：无 cookie 访问 `/analytics`。
- 预期结果：显示预览分析数据；图表正常渲染；不会请求当前用户真实快照。

### GUEST-003 游客访问 Assets

- 优先级：P1
- 步骤：无 cookie 访问 `/assets`。
- 预期结果：显示预览资产数据；添加 source、添加手动资产、同步等真实写入口禁用或提示登录。

### GUEST-004 游客写投资 API 被拒绝

- 优先级：P0
- 步骤：无 cookie 调用 `POST/PATCH/DELETE /api/investments` 和 `/api/investments/:id/finish`。
- 预期结果：全部返回 401；数据库无变化。

### GUEST-005 游客写 Assets API 被拒绝

- 优先级：P0
- 步骤：无 cookie 调用 source/manual/sync/snapshot 写 API。
- 预期结果：全部返回 401；数据库无变化；不会触发外部 adapter。

### GUEST-006 游客设置页边界

- 优先级：P2
- 步骤：无 cookie 访问 `/settings` 并尝试导出、清空、修改资料。
- 预期结果：真实写操作被阻止或提示登录；语言/币种等本地偏好可以切换。

## 6. 投资管理测试用例

### INV-001 新增投资成功

- 优先级：P0
- 步骤：登录用户提交项目、资产名、类型、金额、币种、开始时间、结束时间、预期 APR。
- 预期结果：创建当前用户投资；返回最新 dashboard snapshot；状态默认 `ONGOING`；金额、APR、时间按服务端规则规范化。

### INV-002 新增必填字段校验

- 优先级：P0
- 测试数据：空 project、空 assetName、空 type、空 amount、空 startTime。
- 预期结果：分别返回 400；不会插入半成品记录。

### INV-003 金额边界

- 优先级：P0
- 测试数据：`0`、`0.01`、负数、非数字、极大数字。
- 预期结果：服务端允许非负数；前端表单要求大于 0.01；负数和非数字拒绝；极大数字不导致 NaN/Infinity 或页面崩溃。

### INV-004 URL 校验

- 优先级：P1
- 测试数据：空 URL、`https://example.com/path?q=1`、`not-url`、`javascript:alert(1)`。
- 预期结果：空值保存为 null；合法 URL 规范化；非法 URL 拒绝；脚本 URL 不应作为可点击危险链接执行。

### INV-005 投资类型边界

- 优先级：P1
- 测试数据：`Interest`、`LP`、`Lending`、`CeDeFi`、大小写变体、未知类型。
- 预期结果：已支持类型成功；未知类型不应破坏统计或 UI；如服务端暂未强校验类型，前端必须限制输入，后续应补服务端白名单测试。

### INV-006 开始和结束时间边界

- 优先级：P1
- 测试数据：同一天、结束早于开始、跨月、跨年、闰日、DST 切换地区、无结束时间。
- 预期结果：持有天数最少 1 天；时间按用户时区转 UTC；无结束时间活跃投资可保存；结束早于开始应有明确产品决策，若当前允许则收益计算不崩溃。

### INV-007 APR 边界

- 优先级：P1
- 测试数据：0、0.0001、100、1000、负数、非数字、空值。
- 预期结果：前端拒绝负数和大于 1000；服务端不会保存 NaN；空实际 APR 可为 null；收益计算可处理 0 APR。

### INV-008 编辑自己的投资

- 优先级：P0
- 步骤：用户 A PATCH 自己的投资，修改金额、备注和 APR。
- 预期结果：只更新该记录；`updated_at` 更新；返回最新 snapshot；历史软删除状态不被意外清除。

### INV-009 禁止编辑他人投资

- 优先级：P0
- 步骤：用户 A 用用户 B 的 investment id 调用 PATCH。
- 预期结果：返回 404 或 403；用户 B 数据无变化；响应不泄露用户 B 记录内容。

### INV-010 结束投资成功

- 优先级：P0
- 步骤：调用 `POST /api/investments/:id/finish`，提交 `status = EARLY_ENDED`、endTime、actualApr、incomeTotal。
- 预期结果：状态更新为 `EARLY_ENDED`；若未传 endTime，使用当前时间或原 endTime；返回最新 dashboard snapshot。

### INV-011 禁止 finish 为 ONGOING

- 优先级：P0
- 步骤：finish API 提交 `status = ONGOING`。
- 预期结果：返回 400；记录仍为原状态。

### INV-012 已结束投资收益口径

- 优先级：P1
- 测试数据：仅 actualApr、仅 incomeTotal、两者都有、两者都空。
- 预期结果：已结束投资优先手工实际 APR 或最终收益；有最终收益时可反推实际 APR；统计不出现负持有天数或 NaN。

### INV-013 单条删除强确认

- 优先级：P0
- 步骤：DELETE `/api/investments/:id`，分别提交空确认、`delete`、`DELETE`。
- 预期结果：空确认拒绝；`delete` 因服务端转大写当前会通过；`DELETE` 通过；通过后 `is_deleted = true`，`deleted_at` 有值。

### INV-014 删除后列表和统计排除

- 优先级：P0
- 步骤：软删除一条投资后调用 `GET /api/investments`。
- 预期结果：列表不返回该记录；统计、快照和图表聚合不包含该记录。

### INV-015 禁止删除他人投资

- 优先级：P0
- 步骤：用户 A 删除用户 B 的 investment id。
- 预期结果：返回 404 或 403；用户 B 记录不变。

### INV-016 清空全部投资

- 优先级：P0
- 步骤：用户 A 调用 `DELETE /api/investments`。
- 预期结果：硬删除用户 A 的全部投资；用户 B 数据不受影响；返回空 dashboard snapshot；操作需要 UI 强确认。

### INV-017 投资列表排序

- 优先级：P2
- 步骤：创建不同状态、不同开始/结束时间的投资。
- 预期结果：后端按 `status asc, end_time desc nulls last, start_time desc, id desc` 返回；前端展示顺序稳定。

### INV-018 Dashboard 加权 APR

- 优先级：P1
- 测试数据：两笔活跃投资，金额 1000/3000，APR 10%/20%。
- 预期结果：加权 APR 为 17.5%；只使用活跃本金；已结束和软删除不参与活跃加权。

### INV-019 Dashboard 收益周期换算

- 优先级：P1
- 测试数据：金额 3650，APR 10%，持有天数最少 1。
- 预期结果：日/周/月/年收益符合计算规则；跨时区日期不导致今天新建记录收益为 0 天。

### INV-020 投资备注和文本 XSS

- 优先级：P0
- 测试数据：`<script>alert(1)</script>`、HTML attribute、超长字符串。
- 预期结果：页面按文本展示或安全转义；不会执行脚本；超长文本不破坏布局。

## 7. Analytics 和快照测试用例

### ANA-001 查询组合快照

- 优先级：P1
- 步骤：登录用户调用 `GET /api/analytics/snapshots?days=30`。
- 预期结果：只返回当前用户最近 30 天快照；按日期排序；空数据返回空数组和可用 UI。

### ANA-002 快照查询日期边界

- 优先级：P1
- 测试数据：`days=0`、负数、非数字、超大值、`startDate` 早于所有数据、未来日期。
- 预期结果：非法参数使用安全默认值或返回 400；不会扫描无限范围；未来日期返回空或合理结果。

### ANA-003 手动捕获快照

- 优先级：P1
- 步骤：调用 `POST /api/analytics/snapshots`。
- 预期结果：为当前用户 upsert 今日 `portfolio_daily_snapshots` 和每笔 `investment_daily_snapshots`；同一天重复调用不新增重复组合快照。

### ANA-004 快照排除软删除投资

- 优先级：P0
- 步骤：准备活跃投资和软删除投资后捕获快照。
- 预期结果：组合快照不包含软删除金额；单笔快照不新增软删除记录。

### ANA-005 空组合快照

- 优先级：P2
- 步骤：没有投资时捕获和查询快照。
- 预期结果：总本金、收益、活跃数量为 0；Analytics 页面显示空状态，不崩溃。

### ANA-006 图表数据异常值

- 优先级：P2
- 测试数据：APR 为 0、收益为 0、极大本金、小数很多、缺失 actual APR。
- 预期结果：图表正常渲染；tooltip 和坐标轴不显示 NaN/Infinity；移动端不溢出。

## 8. Assets 测试用例

### AST-001 获取资产总览

- 优先级：P1
- 步骤：登录后调用 `GET /api/assets/summary`。
- 预期结果：返回总资产、来源拆分、类别拆分、Top assets、健康摘要；不返回 encrypted config、API secret、签名 payload 或 raw 敏感字段。

### AST-002 资产总览金额口径

- 优先级：P1
- 测试数据：balances 100、positions net 200、manual active 300、manual deleted 400。
- 预期结果：`totalValueUsd = 600`；软删除手动资产不参与；百分比四舍五入后总和可有小数误差但不为 NaN。

### AST-003 创建 CEX source 成功

- 优先级：P0
- 前置条件：adapter mock 的 `testConnection/getBalances` 成功。
- 步骤：POST `/api/assets/sources`，type CEX，provider BINANCE，name，apiKey，apiSecret。
- 预期结果：source 创建；凭据加密保存在 `encrypted_config`；响应不返回密文和明文凭据；同步被触发；成功后 status 为 `ACTIVE`。

### AST-004 CEX passphrase provider

- 优先级：P1
- 测试数据：OKX、BITGET、KUCOIN 缺 passphrase 和带 passphrase。
- 预期结果：缺少 passphrase 时拒绝；带 passphrase 成功；KUCOIN apiKeyVersion 默认或输入值被保存到加密配置。

### AST-005 CEX source 创建失败

- 优先级：P1
- 前置条件：adapter `testConnection` 抛错。
- 预期结果：创建或同步失败行为符合当前实现；错误摘要写入 `last_error` 或返回错误；不泄露 apiSecret；不会留下不一致 balances。

### AST-006 创建 On-chain source 成功

- 优先级：P1
- 步骤：POST `/api/assets/sources`，type ONCHAIN，provider OKX_WEB3/AUTO，publicRef 为钱包地址。
- 预期结果：保存公开地址；不要求 CEX 凭据；同步调用 on-chain adapter；成功后写入 balances/positions 和资产快照。

### AST-007 On-chain source 缺地址

- 优先级：P0
- 步骤：publicRef 为空创建或更新 On-chain source。
- 预期结果：返回 400；数据库无变化。

### AST-008 Source 数量上限

- 优先级：P0
- 步骤：同一用户已有 10 个 source 后继续创建。
- 预期结果：返回 `Source limit reached.`；不会创建第 11 个；其他用户不受影响。

### AST-009 查询 Sources 分页筛选排序

- 优先级：P2
- 测试参数：status、type、limit、offset、sort=`lastSyncedAt.asc`、`name.asc`、非法 sort。
- 预期结果：只返回当前用户；limit 最大 50；offset 非负；非法 sort 使用默认排序。

### AST-010 更新 source 基本信息

- 优先级：P1
- 步骤：PATCH source name、status、publicRef 或新凭据。
- 预期结果：只更新当前用户 source；CEX 修改凭据时必须 apiKey/apiSecret/passphrase 组合完整；响应不返回 secret。

### AST-011 禁止跨用户操作 source

- 优先级：P0
- 步骤：用户 A 查询、更新、删除、同步用户 B source。
- 预期结果：返回 404；用户 B 数据、balances、positions、logs 不变。

### AST-012 删除 source 级联

- 优先级：P1
- 步骤：删除已有 balances/positions/logs 的 source。
- 预期结果：source 硬删除；相关 balances、positions、sync logs 通过外键级联删除；其他 source 不受影响。

### AST-013 同步单个 source 成功

- 优先级：P1
- 前置条件：source 状态为 PENDING/ACTIVE/FAILED，adapter 返回 balances 和 positions。
- 预期结果：旧 balances/positions 被该 source 新结果覆盖；status 更新为 ACTIVE；lastSyncedAt 更新；写 sync log；捕获资产快照。

### AST-014 同步单个 source 失败

- 优先级：P1
- 前置条件：adapter 抛出 provider error 或网络错误。
- 预期结果：source status 更新为 FAILED；lastError 有摘要；写失败 sync log；旧 balances/positions 不被错误数据污染；错误响应不含 secret。

### AST-015 Disabled source 不被全量同步

- 优先级：P1
- 步骤：准备 DISABLED source，调用 `POST /api/assets/sync` 或 Cron。
- 预期结果：DISABLED source 不被 adapter 调用；状态和 lastSyncedAt 不变。

### AST-016 查询 balances

- 优先级：P2
- 测试参数：sourceId、sourceType、category、q、limit、offset、sort。
- 预期结果：只返回当前用户；支持模糊搜索；不返回 raw_data；分页稳定。

### AST-017 查询 positions

- 优先级：P2
- 测试参数：sourceId、chain、protocol、positionType、limit、offset、sort。
- 预期结果：只返回当前用户；按 netValueUsd 或 updatedAt 排序；不返回 raw_data。

### AST-018 创建手动资产成功

- 优先级：P1
- 步骤：POST `/api/assets/manual`，name、type、amount、valueUsd、note。
- 预期结果：创建未删除 manual asset；捕获资产快照；summary 总资产更新。

### AST-019 手动资产金额边界

- 优先级：P0
- 测试数据：amount/valueUsd 为 0、正小数、负数、非数字、极大值。
- 预期结果：0 和正数成功；负数和非数字拒绝；不出现 NaN/Infinity。

### AST-020 手动资产类型边界

- 优先级：P1
- 测试数据：CASH、STOCK、FUND、TOKEN、REAL_ESTATE、OTHER、未知类型。
- 预期结果：支持类型成功；未知类型应拒绝或前端无法提交；后端若未强校验，需补安全测试和改进项。

### AST-021 手动资产数量上限

- 优先级：P0
- 步骤：同一用户已有 50 个未删除手动资产后继续创建。
- 预期结果：返回 `Manual asset limit reached.`；软删除资产不计入上限。

### AST-022 更新手动资产

- 优先级：P1
- 步骤：PATCH name、amount、valueUsd、note。
- 预期结果：当前用户资产更新；捕获资产快照；summary 刷新。

### AST-023 删除手动资产

- 优先级：P1
- 步骤：DELETE `/api/assets/manual/:id`。
- 预期结果：软删除，`is_deleted = true`、`deleted_at` 有值；查询列表不返回；捕获资产快照。

### AST-024 禁止跨用户操作手动资产

- 优先级：P0
- 步骤：用户 A 查询、更新、删除用户 B manual asset。
- 预期结果：返回 404；用户 B 资产不变。

### AST-025 查询资产快照

- 优先级：P1
- 测试参数：days、startDate、endDate。
- 预期结果：只返回当前用户；同一天 upsert 不重复；breakdown JSON 可解析；非法日期安全处理。

### AST-026 资产健康面板

- 优先级：P2
- 步骤：准备失败 source 和 sync logs，查询 `/api/assets/health`。
- 预期结果：返回失败来源和最近日志；limit 生效；不返回 secret 或 raw adapter 请求。

### AST-027 Assets 首屏轻量加载

- 优先级：P2
- 步骤：访问 `/assets` 并观察 API 请求。
- 预期结果：首屏登录态只请求 summary；Trend/Sources/Manual/Balances/Health tab 点击后懒加载对应 API。

### AST-028 外部凭据加密密钥边界

- 优先级：P0
- 测试数据：缺失 `ASSET_CREDENTIAL_ENCRYPTION_KEY`、base64 长度不足、hex 长度不足、有效 32 bytes key。
- 预期结果：无效密钥时 CEX 凭据加解密失败并给出安全错误；不会保存明文；有效密钥成功。

## 9. Cron 测试用例

### CRON-001 Cron 鉴权缺失

- 优先级：P0
- 步骤：无 Authorization 和 `x-cron-secret` 调用所有 `/api/cron/*`。
- 预期结果：全部返回 401；不执行任务；不写成功 job log。

### CRON-002 Cron 鉴权错误

- 优先级：P0
- 步骤：传入错误 Bearer token 或错误 `x-cron-secret`。
- 预期结果：返回 401；不执行任务。

### CRON-003 Cron 鉴权成功

- 优先级：P0
- 步骤：传入正确 `Authorization: Bearer <CRON_SECRET>`。
- 预期结果：任务执行；返回 processedCount、duration 或任务摘要；写入 `scheduled_job_logs`。

### CRON-004 自动结算到期投资

- 优先级：P1
- 测试数据：已到期 ONGOING、未来到期 ONGOING、无结束日期 ONGOING、ENDED、软删除。
- 预期结果：只把已到期且未删除的 ONGOING 更新为 ENDED；其他记录不变；settledCount 正确。

### CRON-005 自动结算时间边界

- 优先级：P1
- 测试数据：endTime 等于 referenceDate、早 1 毫秒、晚 1 毫秒、不同时区输入。
- 预期结果：小于等于 referenceDate 被结算；晚于不结算；UTC 转换正确。

### CRON-006 投资快照 Cron

- 优先级：P1
- 步骤：调用 `/api/cron/snapshots`。
- 预期结果：先执行自动结算；只处理 `storage_mode = REMOTE` 用户；为每个远程用户 upsert 今日投资和组合快照；写 job log `portfolio-snapshot-capture`。

### CRON-007 Cron 快照重复执行

- 优先级：P1
- 步骤：同一天连续调用 `/api/cron/snapshots`。
- 预期结果：`portfolio_daily_snapshots` 不重复；`investment_daily_snapshots` 不重复；job log upsert 或唯一约束行为稳定。

### CRON-008 到期提醒邮件

- 优先级：P1
- 测试数据：ACTIVE 用户有 ONGOING 投资，含未来 24 小时内到期项目。
- 预期结果：发送邮件；24 小时内到期项目优先展示；包含其他活跃投资摘要；写 job log `investment-expiry-reminders`。

### CRON-009 到期提醒用户边界

- 优先级：P1
- 测试数据：ACTIVE 无活跃投资、PENDING/DISABLED 用户、有软删除投资、有 ENDED 投资。
- 预期结果：只给 ACTIVE 且有未删除 ONGOING 投资的用户发；其他用户不发。

### CRON-010 邮件发送失败

- 优先级：P1
- 前置条件：Resend mock 抛错。
- 预期结果：失败被记录到任务结果或 job log；单个用户失败不应中断所有用户处理，若当前实现会中断则记录为改进项。

### CRON-011 资产同步 Cron

- 优先级：P1
- 步骤：调用 `/api/cron/assets/sync`。
- 预期结果：同步所有 ACTIVE/FAILED/PENDING source；跳过 DISABLED；按用户捕获资产快照；写 job log `asset-source-sync`。

### CRON-012 custom-worker Cron 映射

- 优先级：P1
- 步骤：在 Worker scheduled handler 中传入各 cron 表达式。
- 预期结果：`0 */12 * * *` 转发 snapshots；`0 */4 * * *` 转发 assets sync；`0 1/4 * * *` 转发 settle；`0 2 * * *` 和 `0 14 * * *` 转发 expiry reminders。

## 10. 国际化、币种和时区测试用例

### I18N-001 语言切换

- 优先级：P2
- 步骤：在导航或设置中切换 en/zh。
- 预期结果：页面主要文案切换；刷新后按本地偏好恢复；未翻译 key 不直接裸露给用户。

### I18N-002 显示币种切换

- 优先级：P2
- 测试数据：USD、CNY、EUR、JPY、HKD、SGD 等。
- 预期结果：金额格式和符号正确；汇率请求失败时有降级；基础 USD 数据不被修改。

### I18N-003 汇率 API

- 优先级：P2
- 步骤：调用 `/api/exchange-rate?currency=CNY`、未知币种、上游失败。
- 预期结果：支持币种返回汇率；未知币种安全处理；上游失败返回错误或默认值，不阻塞核心页面。

### I18N-004 用户时区影响日期

- 优先级：P1
- 测试数据：`Asia/Shanghai`、`UTC`、`America/New_York`。
- 预期结果：投资输入时间转 UTC 正确；快照日期 key 按应用时区生成；同一 UTC 时间在不同时区可能归属不同日期。

## 11. UI 和响应式测试用例

### UI-001 Dashboard 桌面布局

- 优先级：P2
- 视口：1440x900。
- 预期结果：导航、统计卡、筛选器、表格、操作按钮清晰可见；无横向滚动；表格操作不遮挡。

### UI-002 Dashboard 移动端布局

- 优先级：P2
- 视口：390x844。
- 预期结果：导航可用；表单弹窗可滚动；表格或列表不溢出；按钮可触达。

### UI-003 Assets tab 状态稳定

- 优先级：P2
- 步骤：切换 Trend/Sources/Manual/Balances/Health，多次新增和同步。
- 预期结果：已加载 tab 缓存策略正常；写操作后 summary 和已打开详情刷新；loading 不造成布局大幅跳动。

### UI-004 表单提交状态

- 优先级：P2
- 步骤：投资、source、manual asset 表单提交时快速重复点击。
- 预期结果：loading 状态阻止重复提交；错误显示在表单或 toast；弹窗不会在失败时误关闭。

### UI-005 错误和空状态

- 优先级：P2
- 步骤：模拟 API 500、401、空列表、网络断开。
- 预期结果：展示明确错误或登录提示；空状态可理解；控制台无未捕获异常。

### UI-006 长文本和特殊字符

- 优先级：P2
- 测试数据：长项目名、长资产名、长 source 名、emoji、中英文混合、HTML 字符。
- 预期结果：文本换行或截断合理；无布局崩坏；HTML 安全转义。

## 12. 安全测试用例

### SEC-001 所有用户数据 API 必须鉴权

- 优先级：P0
- 范围：`/api/investments`、`/api/analytics/snapshots`、`/api/assets/*` 写读真实数据接口。
- 预期结果：无有效 session 返回 401；不会以 guest 身份访问真实数据。

### SEC-002 用户数据隔离

- 优先级：P0
- 步骤：用户 A 枚举用户 B 的 investment/source/manual/snapshot id。
- 预期结果：返回 404/403；响应不包含 B 的字段；数据库无跨用户修改。

### SEC-003 SQL 注入

- 优先级：P0
- 测试数据：`' OR 1=1 --`、`; drop table users; --` 放入搜索、名称、备注、id、sort 参数。
- 预期结果：参数化查询生效；非法 id/sort 被安全处理；数据库结构不变。

### SEC-004 XSS

- 优先级：P0
- 测试数据：script、img onerror、svg onload、markdown link payload 放入所有用户可输入文本。
- 预期结果：页面不执行脚本；导出 JSON 不注入 HTML；toast 和 dialog 安全显示。

### SEC-005 CSRF 风险回归

- 优先级：P1
- 步骤：跨站发起 POST/PATCH/DELETE，浏览器携带 sameSite=lax cookie 的场景。
- 预期结果：普通跨站子请求不携带 cookie；高风险写 API 后续应考虑 CSRF token 或 Origin 校验，当前测试需记录风险。

### SEC-006 Cookie 安全属性

- 优先级：P0
- 环境：development 和 production。
- 预期结果：cookie `httpOnly`、`sameSite=lax`、`path=/`；production `secure=true`；session 30 天过期。

### SEC-007 CEX 凭据不泄露

- 优先级：P0
- 范围：source 创建、更新、查询、summary、health、logs、错误响应、浏览器 console。
- 预期结果：不返回 apiKey/apiSecret/passphrase、encrypted_config、签名头、完整 external payload。

### SEC-008 加密配置不可明文落库

- 优先级：P0
- 步骤：创建 CEX source 后直接查库。
- 预期结果：`encrypted_config` 为 AES-GCM 包装结构；不包含原始 key/secret/passphrase；每次保存 IV 不同。

### SEC-009 生产 AUTH_SECRET 强度

- 优先级：P0
- 步骤：production 环境缺失或使用开发 fallback。
- 预期结果：构建或启动阶段应有告警或失败；若当前代码仍 fallback，需要作为上线阻断风险记录。

### SEC-010 Cron Secret 不泄露

- 优先级：P0
- 步骤：错误调用 cron、查看响应、日志和 job log。
- 预期结果：不回显 `CRON_SECRET`；错误信息简洁。

### SEC-011 外部错误脱敏

- 优先级：P1
- 前置条件：CEX/OKX adapter 抛出包含 request headers 或 secret 的错误。
- 预期结果：`last_error`、sync log 和响应只保留安全摘要；不包含 Authorization、API key、signature、passphrase。

### SEC-012 诊断 API 访问控制

- 优先级：P1
- 范围：`GET /api/diagnostics/egress`。
- 预期结果：确认是否需要鉴权或仅生产禁用；如果当前公开，应记录风险并限制 includeIp 输出。

## 13. 数据库和持久化测试用例

### DB-001 schema 初始化

- 优先级：P0
- 步骤：对空测试数据库执行 `db/schema.sql`。
- 预期结果：所有表、索引、唯一约束创建成功；重复执行幂等。

### DB-002 唯一约束

- 优先级：P0
- 范围：users.email、auth_accounts provider/account、portfolio snapshot user/date、asset snapshot user/date。
- 预期结果：重复写入触发约束或 upsert；业务层返回可理解错误。

### DB-003 外键级联

- 优先级：P1
- 步骤：删除用户或 asset source。
- 预期结果：相关 auth accounts、investments、assets、logs 按 schema 级联或 set null；无孤儿数据。

### DB-004 软删除语义

- 优先级：P0
- 范围：investments、manual_assets。
- 预期结果：普通查询排除软删除；软删除记录保留审计字段；清空全部投资按当前实现硬删除。

### DB-005 数字精度和空值

- 优先级：P1
- 测试数据：小数很多、0、null APR、null income、极大 valueUsd。
- 预期结果：数据库和 JSON 响应不出现 NaN/Infinity；UI 格式化稳定。

## 14. 构建、部署和兼容测试用例

### BUILD-001 Next.js 普通构建

- 优先级：P0
- 命令：`npm run next:build`
- 预期结果：构建成功；无 TypeScript/React 构建错误。

### BUILD-002 OpenNext Cloudflare 构建

- 优先级：P0
- 命令：`npm run build`
- 预期结果：生成 `.open-next/worker.js` 和 `.open-next/assets`；无 node API 兼容错误。

### BUILD-003 Cloudflare 预览冒烟

- 优先级：P1
- 命令：`npm run preview`
- 预期结果：Dashboard、Assets、Analytics、Settings、Auth 页面可访问；API routes 可响应；Cron 路由鉴权正常。

### BUILD-004 环境变量模板安全

- 优先级：P0
- 步骤：检查 `.env.example`。
- 预期结果：只包含语义占位值；不得包含真实第三方 key、secret、passphrase、database password、webhook secret。

### BUILD-005 Wrangler cron 配置

- 优先级：P1
- 步骤：检查 `wrangler.jsonc`。
- 预期结果：cron 表达式与 `custom-worker.js` 映射一致；`keep_vars = true`；`nodejs_compat` 开启；入口指向 `custom-worker.js`。

## 15. 性能和可靠性测试用例

### PERF-001 Assets 首屏性能

- 优先级：P2
- 数据量：10 sources、1000 balances、200 positions、50 manual assets、365 snapshots。
- 预期结果：首屏只加载 summary；不会一次拉取全部明细；页面交互可用。

### PERF-002 列表分页上限

- 优先级：P2
- 范围：sources、balances、positions、manual、health。
- 预期结果：limit 最大 50；非法 limit 使用默认；offset 大于总数返回空列表。

### PERF-003 Cron 大数据量

- 优先级：P1
- 数据量：100 用户、每用户 10 sources 或 100 投资。
- 预期结果：任务能在 Worker 时间预算内完成或暴露需要分页/队列化的风险；失败写 job log。

### PERF-004 外部 API 限流

- 优先级：P1
- 步骤：adapter 返回 429 或超时。
- 预期结果：source 标记 FAILED；错误摘要安全；不会无限重试；其他 source 继续处理。

## 16. 手工回归清单

每次发布前至少执行以下 P0/P1 路径：

1. 游客打开 `/`、`/assets`、`/analytics`，确认预览只读。
2. 邮箱验证码注册、登录、登出、Session 刷新。
3. 新增、编辑、提前结束、软删除、清空当前用户投资。
4. 两个用户互相枚举投资和资产 id，确认隔离。
5. 手动捕获投资快照，确认同日 upsert。
6. 添加 CEX source、On-chain source、手动资产，并确认 summary 更新。
7. 同步 source 成功和失败各一次，确认 health 和 sync log。
8. 调用所有 Cron route 的无密钥、错密钥、正确密钥场景。
9. 切换语言、显示币种和时区，刷新后确认偏好。
10. 桌面和移动端检查 Dashboard、Assets 表单和图表。
11. 运行 `npm run build`。

## 17. 建议自动化分层

- 单元测试：
  - `lib/calculations.ts`
  - `lib/time.ts`
  - `lib/auth.ts`
  - `lib/assets/encryption.ts`
  - `lib/snapshot.ts`
  - `lib/snapshot-history.ts`
- 集成测试：
  - Auth API
  - Investment API
  - Analytics snapshot API
  - Assets API
  - Cron API
- E2E 测试：
  - 游客预览路径
  - 注册登录路径
  - Dashboard 投资 CRUD
  - Assets source/manual/sync 路径
  - Settings 偏好和数据管理
- 安全测试：
  - 鉴权缺失
  - 跨用户 id 枚举
  - XSS payload
  - SQL injection payload
  - CEX 凭据脱敏
  - Cron secret 鉴权

## 18. 已识别风险和需补充决策

- 投资服务端当前对 `type` 没有严格白名单校验，依赖前端限制；建议补服务端校验。
- 投资服务端允许 amount 为 0，而前端要求大于 0.01；需确认产品口径。
- 单条删除确认文本服务端当前大小写不敏感，需求文档写的是输入 `DELETE`；需确认是否必须严格大小写。
- 结束时间早于开始时间的服务端行为需明确；当前测试应确保至少不崩溃。
- 生产缺失 `AUTH_SECRET` 时当前 auth helper 有开发 fallback；上线前建议加入 production 强校验。
- 诊断 egress API 需要确认生产访问控制，避免公开网络诊断信息。
- 到期提醒当前每天两次给所有有活跃投资的活跃用户发送摘要，不受通知开关控制；这是当前产品边界，测试不应误判为 bug，但需要纳入后续优化。
- Assets Cron 当前随 source 数量线性同步，用户量增长后可能需要分页、分片或队列化。
