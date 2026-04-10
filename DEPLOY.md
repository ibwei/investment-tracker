# Vercel Deployment

## Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string used by Prisma in production.
- `AUTH_SECRET`: long random string for signing session cookies.
- `CRON_SECRET`: long random string used by `/api/cron/snapshots`.
- `APP_URL`: your production app URL, for example `https://your-project.vercel.app`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: optional, if Google OAuth is enabled.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: optional, if GitHub OAuth is enabled.

## Snapshot Cron

- `vercel.json` schedules `/api/cron/snapshots` at `12:00 UTC` every day.
- `12:00 UTC` equals `20:00` in `Asia/Shanghai`.
- The cron route requires `CRON_SECRET`.
- On Vercel Production, cron invocations automatically include `Authorization: Bearer <CRON_SECRET>`.
- The route also accepts `x-cron-secret` so you can test it manually from tools like `curl` or Postman.

## First Production Deploy

1. Provision a PostgreSQL database for production.
2. Add the environment variables in the Vercel project settings.
3. Run `prisma migrate deploy` or `prisma db push` against the production database before the cron runs.
4. Deploy the app to Vercel.
5. Visit `/analytics` and use "Capture Today" once if you want an immediate first snapshot instead of waiting for the scheduled run.

## Notes

- Vercel cron jobs run only on the `Production` deployment.
- Cron schedules on Vercel are always interpreted in `UTC`.
