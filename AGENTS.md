# AGENTS.md

This file gives coding agents the project context and working rules for Earn Compass. Read it before making changes in this repository.

## Project Overview

Earn Compass is a Next.js full-stack app for managing CeFi / DeFi yield investments. The current product shape is:

- Guests see read-only preview data.
- Authenticated users manage real investment records through remote APIs.
- Users can view Dashboard, Analytics, Settings, Login, and Register pages.
- The app supports email/password auth, Google OAuth, GitHub OAuth, portfolio snapshots, cron jobs, i18n, and display currency preferences.

The most useful product and architecture references are:

- `README.md`
- `prd.md`
- `tech.md`
- `DEPLOY.md`

Treat these files as the source of product and technical intent, but verify behavior against the code when in doubt.

## Tech Stack

- Framework: Next.js 16 App Router
- React: React 19
- Language: mixed JavaScript and TypeScript
- Styling: Tailwind CSS 4 with custom UI components
- UI primitives: Radix UI, selected Ant Design dependencies
- State: Zustand
- Forms: react-hook-form and zod
- Charts: Recharts
- Database: PostgreSQL
- Database access: `pg` with parameterized SQL repositories
- Local storage abstraction: Dexie / IndexedDB
- Auth: custom session cookie plus OAuth
- Deployment target: Cloudflare Workers through OpenNext for Cloudflare
- Observability: no platform analytics SDK is currently wired; Cloudflare Web Analytics / Zaraz can be added later

## Common Commands

Use npm as the primary package manager because `package-lock.json` is present.

```bash
npm install
npm run dev
npm run build
npm run preview
npm run deploy
npm run start
```

Notes:

- There is no configured test or lint script at the time of writing.
- New PostgreSQL databases should be initialized with `db/schema.sql`.
- Do not run production database commands unless the target database is explicit and intentional.

## Environment

Required production variables:

- `DATABASE_URL`
- `AUTH_SECRET`
- `ASSET_CREDENTIAL_ENCRYPTION_KEY`
- `CRON_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Optional OAuth variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Local development may also use `NEXT_PUBLIC_APP_URL`. `lib/auth.js` falls back to a development auth secret if `AUTH_SECRET` is absent, but production must always provide a strong secret.

## Repository Structure

```text
app/                     Next.js pages, layouts, and API routes
app/api/                 Route handlers for auth, investments, analytics, cron, utilities
components/              Page components and shared UI
components/dashboard/    Dashboard table, filters, form, stats
components/analytics/    Analytics charts and summaries
components/layout/       Navigation and layout components
components/ui/           Local UI primitive wrappers
hooks/                   Client hooks
lib/                     Auth, users, investments, calculations, snapshots, i18n, storage
lib/storage/             Dexie client and repository abstraction
db/                      PostgreSQL schema
store/                   Global app-level Zustand store
figma/                   Figma and design reference artifacts
public/                  Static assets
```

Path alias:

- `@/*` maps to the repository root.

## Architecture Notes

The app is organized in five practical layers:

- Page/API layer: `app/*`
- Component layer: `components/*`
- Client state layer: `lib/store.ts`, `store/app-store.js`
- Domain/service layer: `lib/investments.ts`, `lib/snapshot-history.ts`, `lib/users.ts`
- Persistence layer: PostgreSQL via `pg` and Dexie repositories

Current data mode behavior:

- The default product path is remote data for authenticated users.
- Unauthenticated users enter preview mode and use `previewInvestments`.
- Dexie and `storageMode` abstractions still exist, but the mature user-facing path is not a full local/remote switcher.
- Avoid expanding local-mode behavior unless the task explicitly asks for it.

## Auth Model

The project does not use NextAuth.

Auth is implemented in `lib/auth.js`:

- Session cookie name: `earn_compass_session`
- Session signing: HMAC-SHA256
- Session lifetime: 30 days
- Password hashing: Node `scrypt`
- Server routes call `requireSession()` to protect authenticated APIs.

User and OAuth logic lives in:

- `lib/users.ts`
- `lib/oauth.js`
- `app/api/auth/*`

OAuth providers currently supported:

- Google
- GitHub

When adding auth-sensitive code, keep all data scoped by `session.userId`.

## Data Model

PostgreSQL schema is in `db/schema.sql`.

Core models:

- `User`
- `AuthAccount`
- `Investment`
- `InvestmentDailySnapshot`
- `PortfolioDailySnapshot`
- `OperationLog`
- `ScheduledJobLog`

Important investment status values:

- `ONGOING`
- `ENDED`
- `EARLY_ENDED`

Important investment type values:

- `Interest`
- `LP`
- `Lending`
- `CeDeFi`

Frontend types normalize these into lower-case/client-friendly values in `lib/store.ts`.

## Business Rules

Investment and income rules are mainly in:

- `lib/calculations.js`
- `lib/investments.js`
- `lib/snapshot.js`
- `lib/snapshot-history.js`

Preserve these rules unless the task explicitly changes product behavior:

- Holding days are at least 1 day.
- Active investments use expected APR for projected income.
- Ended investments prefer manually entered actual APR or final total income.
- If final total income exists, actual APR can be derived from principal and holding days.
- Guests/preview mode must not perform real write operations.
- Single investment deletion is soft deletion.
- Destructive delete flows require strong confirmation where already implemented.

## API Conventions

Route handlers are under `app/api`.

Common patterns:

- Use `NextResponse.json(...)`.
- Set `export const dynamic = "force-dynamic"` for dynamic API routes when needed.
- Use `export const runtime = "nodejs"` for routes that depend on Node APIs or PostgreSQL access.
- Protect user data with `requireSession()`.
- Return compact JSON errors with an appropriate status.

Key APIs:

- `GET /api/investments`
- `POST /api/investments`
- `PATCH /api/investments/:id`
- `DELETE /api/investments/:id`
- `POST /api/investments/:id/finish`
- `DELETE /api/investments`
- `GET /api/analytics/snapshots`
- `POST /api/analytics/snapshots`
- `GET /api/exchange-rate`
- `GET /api/cron/snapshots`
- `GET /api/cron/investments/expiry-reminders`

## Cron Jobs

Cloudflare cron configuration is in `wrangler.jsonc`:

- `/api/cron/snapshots` runs daily at `12:00 UTC`.
- `/api/cron/investments/expiry-reminders` runs daily at `02:00 UTC`.

Cloudflare calls `custom-worker.js` through the Worker `scheduled()` handler. The handler forwards to the existing cron API routes with `Authorization: Bearer <CRON_SECRET>`. Routes may also accept `x-cron-secret` for manual testing if implemented.

Cron jobs should:

- Run only server-side Node-compatible code.
- Avoid processing guest/preview data.
- Scope processing to intended remote users.
- Write `ScheduledJobLog` when the existing job framework does so.

## Frontend Guidelines

- Follow existing components before introducing new UI abstractions.
- Prefer files in `components/ui/*` for shared primitives.
- Keep Dashboard work in `components/dashboard/*`.
- Keep Analytics work in `components/analytics/*`.
- Keep route-level composition in `app/*/page.js`.
- Use existing i18n helpers from `lib/i18n.tsx` for user-facing text.
- Preserve responsive behavior for desktop and mobile.
- Do not make preview users think a write succeeded; disable or intercept writes.
- Use `sonner`/existing toast patterns for user feedback.

## Code Style

- The repo currently mixes `.js`, `.ts`, and `.tsx`; match the surrounding file style.
- Prefer TypeScript for new shared types or new React components when it fits the touched area.
- Use the `@/` alias for root imports when nearby code does.
- Keep comments rare and useful.
- Avoid broad refactors while making focused fixes.
- Do not introduce new dependencies unless the task clearly needs them.
- Do not migrate the app to a different auth, database, charting, or UI framework without an explicit request.

## Database and Persistence Rules

- Keep SQL column names in repository queries consistent with `db/schema.sql`.
- User-owned records must be filtered by `userId`.
- Respect soft deletion via `isDeleted` and `deletedAt`.
- Be careful with `clearAllInvestments`; check existing semantics before changing delete behavior.
- Use repository abstractions in `lib/storage/repositories/*` for client-side investment operations.
- Do not add local SQLite files as production data; the active database is PostgreSQL.

## Verification

Before finishing a code change, run the strongest relevant check available:

```bash
npm run build
```

For database schema changes, update `db/schema.sql` and apply it only to the intended database.

If a dev server is needed for manual verification:

```bash
npm run dev
```

Then verify the changed route or page in the browser. If checks cannot be run because environment variables or services are missing, state that clearly in the handoff.

## Agent Safety Rules

- Do not overwrite user changes. Check `git status --short` before editing if the task may overlap with current work.
- Keep edits scoped to the requested behavior.
- Do not commit, push, deploy, or modify production data unless explicitly asked.
- Do not add secrets to the repository.
- Do not edit generated or dependency directories such as `node_modules` or `.next`.
- Do not assume old references to SQLite, NextAuth, TradingView, or Ant Design-first UI are current; the code and current docs supersede older plans.

## Good First Files To Inspect

For product behavior:

- `prd.md`
- `README.md`
- `components/dashboard-workspace.js`
- `components/analysis-workspace.js`

For technical behavior:

- `tech.md`
- `lib/store.ts`
- `lib/investments.ts`
- `lib/calculations.js`
- `lib/snapshot-history.js`
- `db/schema.sql`

For auth:

- `lib/auth.js`
- `lib/users.ts`
- `lib/oauth.js`
- `components/auth-provider.tsx`

For deployment:

- `DEPLOY.md`
- `wrangler.jsonc`
- `custom-worker.js`
- `app/api/cron/*`
