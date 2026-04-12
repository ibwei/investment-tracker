# Cloudflare Deployment

Earn Compass is deployed to Cloudflare Workers through OpenNext for Cloudflare. The app still uses PostgreSQL through Prisma; the existing PostgreSQL connection URL can be reused as long as the database accepts external connections from Cloudflare Workers.

## Required Environment Variables

- Secrets:
  - `DATABASE_URL`: PostgreSQL connection string used by Prisma in production.
  - `AUTH_SECRET`: long random string for signing session cookies.
  - `CRON_SECRET`: long random string used by cron routes.
  - `RESEND_API_KEY`: Resend API key used to send investment expiry reminder emails.
  - `GOOGLE_CLIENT_SECRET`: optional, if Google OAuth is enabled.
  - `GITHUB_CLIENT_SECRET`: optional, if GitHub OAuth is enabled.
- Non-secret runtime vars:
  - `RESEND_FROM_EMAIL`: sender identity for reminder emails, for example `CeFiDeFi <alerts@yourdomain.com>`.
  - `APP_URL`: production app URL, for example `https://earn-compass.example.workers.dev`.
  - `NEXT_PUBLIC_APP_URL`: public app URL used by client-visible metadata and links.
  - `GOOGLE_CLIENT_ID`: optional, if Google OAuth is enabled.
  - `GITHUB_CLIENT_ID`: optional, if GitHub OAuth is enabled.

For local Cloudflare preview, copy `.dev.vars.example` to `.dev.vars` and fill in real values. Do not commit `.dev.vars`.

## Runtime Vars vs Build Vars

- `Settings > Variables and Secrets` is for Worker runtime values. Registration, login, Prisma, cron, and OAuth all read from runtime values.
- `Settings > Build > Environment variables` is only for the Git build machine. Values configured there do not appear at runtime inside the deployed Worker.
- `wrangler deploy` treats `wrangler.jsonc` as the source of truth for dashboard vars unless `keep_vars` is enabled.
- This repository sets `"keep_vars": true` in [wrangler.jsonc](/Users/baiwei/Desktop/berry/earn/cefidefi/wrangler.jsonc:1) so dashboard-managed runtime vars are preserved across deploys.

## Scheduled Jobs

- `wrangler.jsonc` schedules `/api/cron/snapshots` at `12:00 UTC` every day. This route also converts matured `ONGOING` investments into `ENDED` before capturing snapshots.
- `wrangler.jsonc` schedules `/api/cron/investments/expiry-reminders` at `02:00 UTC` every day.
- `12:00 UTC` equals `20:00` in `Asia/Shanghai`.
- `02:00 UTC` equals `10:00` in `Asia/Shanghai`.
- Cloudflare calls `custom-worker.js` through the Worker `scheduled()` handler.
- The scheduled handler forwards requests to the existing cron API routes with `Authorization: Bearer <CRON_SECRET>`.
- The cron routes also accept `x-cron-secret` so they can be tested manually from tools like `curl` or Postman.
- The expiry reminder route emails each active user with `ONGOING` investments every day. Investments expiring in the next 24 hours are shown first, followed by the user's other active investments.

## First Production Deploy

1. Keep or provision a PostgreSQL database for production.
2. Run `npm install`.
3. Run `npm run db:migrate` or `npm run db:push` against the intended database before the first cron run.
4. Add Cloudflare runtime secrets with `wrangler secret put`, including `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, and OAuth secrets if used.
5. Configure runtime non-secret vars such as `APP_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_FROM_EMAIL`, and OAuth client IDs in `Settings > Variables and Secrets`.
6. In the Cloudflare Git build settings, set:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Version upload command: `npx wrangler versions upload`
7. Deploy with `npm run deploy` for local CLI deploys, or trigger a Git build from Cloudflare.
8. Visit `/analytics` and use "Capture Today" once if you want an immediate first snapshot instead of waiting for the scheduled run.

## Useful Commands

```bash
npm run next:build
npm run build
npm run preview
npm run deploy
npm run cf-typegen
npm run db:push
npm run db:migrate
```

## Notes

- `npm run next:build` runs a plain Next.js production build.
- `npm run build` runs the OpenNext for Cloudflare build and writes `.open-next/worker.js` plus `.open-next/assets`.
- Use npm as the only package manager for this repository. Do not add `yarn.lock` or `pnpm-lock.yaml`.
- `npx wrangler deploy` is the deploy command after `npm run build` has produced `.open-next`; it is not a replacement for the build command.
- The Next.js production build uses webpack explicitly to avoid Turbopack process/port issues in restricted CI environments.
- Cron schedules on Cloudflare are interpreted in `UTC`.
- The project uses `compatibility_flags: ["nodejs_compat"]` because auth and Prisma rely on Node-compatible APIs.
- Prisma uses `@prisma/adapter-pg` so PostgreSQL access works in the Cloudflare Workers runtime.
- Keeping a Vercel-provisioned PostgreSQL URL is acceptable for the migration phase if the database allows external connections and the latency is acceptable. Moving the database can be evaluated separately after the application is stable on Cloudflare.
