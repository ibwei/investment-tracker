# Earn Compass

Earn Compass 是一个用于管理 CeFi / DeFi 收益型投资仓位的 Next.js 应用。它支持记录投资信息、查看收益仪表盘、分析组合表现，并通过每日快照追踪历史变化。

当前代码中的实际产品形态是：

- 未登录用户进入预览模式，浏览只读示例数据
- 登录用户管理自己的真实投资数据
- 支持邮箱密码登录注册，以及 Google / GitHub OAuth
- 支持 Dashboard、Analytics、Settings 三个核心页面

## 功能概览

- 投资记录管理：新增、编辑、删除、提前结束
- 收益总览：活跃本金、日收益、月收益、APR 等指标
- 分析图表：收益趋势、APR 分布、项目占比、组合波动
- 快照系统：手动捕获和定时捕获组合快照
- 设置中心：个人资料、语言、显示币种、数据导出、数据清空

## 技术栈

- Next.js 16
- React 19
- Prisma
- PostgreSQL
- OpenNext Cloudflare
- Cloudflare Workers
- Zustand
- Tailwind CSS 4
- Radix UI
- Recharts
- Dexie

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env`，至少包含：

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="replace-with-a-long-random-string"
CRON_SECRET="replace-with-a-long-random-string"
APP_URL="http://localhost:3000"
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

### 3. 初始化数据库

```bash
npm run db:push
```

### 4. 启动开发环境

```bash
npm run dev
```

默认访问地址：

- [http://localhost:3000](http://localhost:3000)

## 常用脚本

```bash
npm run dev
npm run build
npm run preview
npm run deploy
npm run start
npm run db:push
npm run db:migrate
```

## 项目结构

```text
app/                     Next.js 页面与 API
components/              页面组件与基础 UI
lib/                     鉴权、投资逻辑、快照、i18n、状态管理
prisma/                  Prisma schema
store/                   全局 app store
figma/                   Figma 相关产物
wrangler.jsonc           Cloudflare Workers 与 Cron 配置
custom-worker.js         OpenNext Worker 入口与定时任务转发
prd.md                   最新产品文档
tech.md                  最新技术文档
```

## 关键实现说明

- 鉴权使用自定义 session cookie，不依赖 NextAuth
- 数据库当前为 PostgreSQL，不是旧文档中的 SQLite
- 未登录态使用内置 preview 数据，不可写
- 定时任务会为远程用户生成投资快照和组合快照，并在用户有活跃投资时每天发送邮件摘要，24 小时内到期项目会优先展示

## 部署

项目默认面向 Cloudflare Workers 部署，详细说明可参考 [DEPLOY.md](/Users/baiwei/Desktop/berry/earn/cefidefi/DEPLOY.md:1)。

生产环境必须配置：

- `DATABASE_URL`
- `AUTH_SECRET`
- `CRON_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## 文档

- [prd.md](/Users/baiwei/Desktop/berry/earn/cefidefi/prd.md:1)
- [tech.md](/Users/baiwei/Desktop/berry/earn/cefidefi/tech.md:1)
- [DEPLOY.md](/Users/baiwei/Desktop/berry/earn/cefidefi/DEPLOY.md:1)
