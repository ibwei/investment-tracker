# Cloudflare Deployment

Earn Compass is deployed to Cloudflare Workers through OpenNext for Cloudflare. The app uses PostgreSQL through `pg` and a small SQL repository layer; the existing PostgreSQL connection URL can be reused as long as the database accepts external connections from Cloudflare Workers.

## Required Environment Variables

- Secrets:
  - `DATABASE_URL`: PostgreSQL connection string used by the runtime API routes in production.
  - `AUTH_SECRET`: long random string for signing session cookies.
  - `ASSET_CREDENTIAL_ENCRYPTION_KEY`: 32-byte master key for encrypting stored CEX API Key, API Secret, and Passphrase values. Generate with `openssl rand -base64 32` and store as `base64:<output>`.
  - `CRON_SECRET`: long random string used by cron routes.
  - `RESEND_API_KEY`: Resend API key used to send investment expiry reminder emails.
  - `OKX_WEB3_API_KEY`: OKX Web3 API key used by the Assets on-chain provider.
  - `OKX_WEB3_API_SECRET`: OKX Web3 API secret used to sign on-chain provider requests.
  - `OKX_WEB3_PASSPHRASE`: OKX Web3 API passphrase used to sign on-chain provider requests.
  - `OKX_WEB3_PROJECT_ID`: optional OKX Web3 project ID, if required by the OKX Web3 app.
  - `GOOGLE_CLIENT_SECRET`: optional, if Google OAuth is enabled.
  - `GITHUB_CLIENT_SECRET`: optional, if GitHub OAuth is enabled.
- Non-secret runtime vars:
  - `RESEND_FROM_EMAIL`: sender identity for reminder emails, for example `CeFiDeFi <alerts@yourdomain.com>`.
  - `APP_URL`: production app URL, for example `https://earn-compass.example.workers.dev`.
  - `NEXT_PUBLIC_APP_URL`: public app URL used by client-visible metadata and links.
  - `GOOGLE_CLIENT_ID`: optional, if Google OAuth is enabled.
  - `GITHUB_CLIENT_ID`: optional, if GitHub OAuth is enabled.

Use [.env.example](/Users/baiwei/Desktop/berry/earn/cefidefi/.env.example:1) as the single environment variable template. Copy it to `.env` for regular Next.js local development, or copy it to `.dev.vars` for local Cloudflare preview through Wrangler. Fill in real values before running `npm run preview`. Do not commit `.env` or `.dev.vars`.

Do not create `var.env` or `vars.env`. If one appears locally, migrate its values into `.env` or `.dev.vars` as appropriate, then delete it.

## Runtime Vars vs Build Vars

- `Settings > Variables and Secrets` is for Worker runtime values. Registration, login, cron, and OAuth all read from runtime values.
- `Settings > Build > Environment variables` is only for the Git build machine. Values configured there do not appear at runtime inside the deployed Worker.
- `wrangler deploy` treats `wrangler.jsonc` as the source of truth for dashboard vars unless `keep_vars` is enabled.
- This repository sets `"keep_vars": true` in [wrangler.jsonc](/Users/baiwei/Desktop/berry/earn/cefidefi/wrangler.jsonc:1) so dashboard-managed runtime vars are preserved across deploys.

## Scheduled Jobs

- `wrangler.jsonc` schedules `/api/cron/snapshots` every 12 hours with `0 */12 * * *`. This route also converts matured `ONGOING` investments into `ENDED` before capturing snapshots.
- `wrangler.jsonc` schedules `/api/cron/investments/settle` every 4 hours, offset by 1 hour from the asset sync job, with `0 1/4 * * *`.
- `wrangler.jsonc` schedules `/api/cron/investments/expiry-reminders` at `02:00 UTC` and `14:00 UTC` every day.
- Snapshot capture runs at `08:00` and `20:00` in `Asia/Shanghai`.
- Auto-settle runs at `09:00`, `13:00`, `17:00`, `21:00`, `01:00`, and `05:00` in `Asia/Shanghai`.
- `02:00 UTC` equals `10:00` in `Asia/Shanghai`.
- `14:00 UTC` equals `22:00` in `Asia/Shanghai`.
- Cloudflare calls `custom-worker.js` through the Worker `scheduled()` handler.
- The scheduled handler forwards requests to the existing cron API routes with `Authorization: Bearer <CRON_SECRET>`.
- The cron routes also accept `x-cron-secret` so they can be tested manually from tools like `curl` or Postman.
- The expiry reminder route emails each active user with `ONGOING` investments twice per day at `10:00` and `22:00` in `Asia/Shanghai`. Investments expiring in the next 24 hours are shown first, followed by the user's other active investments.

## First Production Deploy

1. Keep or provision a PostgreSQL database for production.
2. Run `npm install`.
3. If this is a new database, run [db/schema.sql](/Users/baiwei/Desktop/berry/earn/cefidefi/db/schema.sql:1) against the intended PostgreSQL database before the first cron run.
4. Add Cloudflare runtime secrets with `wrangler secret put`, including `DATABASE_URL`, `AUTH_SECRET`, `ASSET_CREDENTIAL_ENCRYPTION_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, and OAuth secrets if used.
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
```

## Notes

- `npm run next:build` runs a plain Next.js production build.
- `npm run build` runs the OpenNext for Cloudflare build and writes `.open-next/worker.js` plus `.open-next/assets`.
- Use npm as the only package manager for this repository. Do not add `yarn.lock` or `pnpm-lock.yaml`.
- `npx wrangler deploy` is the deploy command after `npm run build` has produced `.open-next`; it is not a replacement for the build command.
- The Next.js production build uses webpack explicitly to avoid Turbopack process/port issues in restricted CI environments.
- Cron schedules on Cloudflare are interpreted in `UTC`.
- The project uses `compatibility_flags: ["nodejs_compat"]` because auth and `pg` rely on Node-compatible APIs.
- Database access uses parameterized SQL through `pg`; Prisma is not used at runtime.
- Keeping a Vercel-provisioned PostgreSQL URL is acceptable for the migration phase if the database allows external connections and the latency is acceptable. Moving the database can be evaluated separately after the application is stable on Cloudflare.
