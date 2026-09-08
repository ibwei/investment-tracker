# Interaction performance

Investment writes confirm only after the database transaction commits. The primary UI uses the optional `response=delta` mode on `/api/investments`, `/api/investments/:id`, and `/api/investments/:id/finish`:

- GET returns `{ records, meta }` without repeated active/history lists.
- Create, update and finish return `{ record }` with the same server-calculated metrics as the full snapshot.
- DELETE retains its legacy envelope: `{ success: true, snapshot: { removedId } }`; clear-all returns `{ snapshot: { cleared: true } }`.
- Requests without the option retain their existing full snapshot response.

The store merges confirmed records by ID, locks conflicting operations, rejects reads started before a write, and coalesces reconciliation after outstanding writes finish. A failed reconciliation retains confirmed data. An ambiguous network result never automatically retries a write; the user refreshes and checks the records before acknowledging the uncertainty. Guest data is read-only. Account changes cancel requests and discard the previous account's data.

Investment data is streamed from the server for the initial dashboard. Subsequent navigation shares a 30-second in-memory freshness window. Resource reads are keyed by account and complete URL (including query parameters); concurrent reads share a promise. Asset mutations invalidate detail caches, apply the confirmed summary, and refresh only the visible detail. Other tabs refresh when visited. Hidden-tab and reconnection refreshes do not clear existing data.

Asset summaries use one SQL statement with materialized user-owned base sets. Balance and position replacement uses batches of at most 100 rows inside the existing transaction. Duplicate balances retain the existing merge rules; position duplicates retain last-write-wins semantics for non-null unique keys. Manual writes, individual source writes/syncs and their snapshots commit atomically. These short transactions lock the account row before writing so overlapping asset changes cannot overwrite a snapshot with an incomplete total; provider requests remain outside the transaction. Failed syncs retain their last successful balances and timestamp. Failure to read the summary after commit is returned as a missing summary, which the UI reads separately. Bulk synchronization still runs three sources concurrently and captures the aggregate snapshot afterwards.

## Observing performance

Investment, asset and snapshot APIs return `Cache-Control: private, no-store` and `Server-Timing`. Durations include total handler time and, where applicable, database connection, queries, commit, calculation and provider calls. Requests over one second emit aggregate timings only; no SQL, account identifiers, payloads or credentials are logged. Existing Cloudflare observability configuration is unchanged.

Compare equivalent datasets, connection paths and deployment builds before judging P95. Development compilation and the embedded test database are not production latency measurements. Do not enable public caching for private responses or change Hyperdrive placement/indexes without evidence from the deployment and query plans.

## Verification

```sh
npm run test:performance
npm run benchmark:performance
npm run build
```

The default tests exercise request ordering, deduplication, confirmed-only updates, account isolation, unknown outcomes and timing isolation without a database. `benchmark:performance` compares full-snapshot calculation against the single-record calculation at 10, 100 and 1,000 simulated records; it excludes network and database time.

SQL tests use an explicitly supplied PGlite installation and create an in-memory PostgreSQL database from `db/schema.sql`. They never load `.env` or connect to `DATABASE_URL`. No application dependency is needed:

```sh
npm install --prefix /tmp/earn-compass-performance-qa --no-save --package-lock=false @electric-sql/pglite
EARN_TEST_PGLITE_PATH=/tmp/earn-compass-performance-qa/node_modules/@electric-sql/pglite npm run test:performance
```

Optionally set `EARN_TEST_ASSETS_BASELINE` to a saved pre-change `lib/assets/service.ts` file to compare every summary field against the previous implementation. SQL tests otherwise check fixed expected totals and categories, batch sizes, soft deletion, user isolation, metric equivalence, rollback and post-commit read failure.

Before deployment, verify authenticated desktop/mobile CRUD, asset tab navigation, a successful write followed by a failed refresh, slow-write messaging, rapid trend-range changes, export, guest read-only behavior and account switching. Use a designated test database/account. Production P95, LCP, INP and CLS require a separate measurement on the deployed build.

## Verified locally

- The isolated regression suite passed all 16 tests, including PostgreSQL-compatible SQL execution, financial metric parity, batch replacement, rollback, response compatibility and request races.
- The full OpenNext/Cloudflare production build passed.
- Browser checks against the production build with an isolated, seeded test database passed on desktop and mobile. They covered create/edit/end/delete, export, a write delayed beyond three seconds, successful writes followed by failed refreshes, trend-response ordering, logout, session expiry and guest read-only behavior. No browser errors or horizontal page overflow were observed.
- The initial dashboard made zero additional client investment reads. Asset initialization made one summary request. A manual asset save made the write plus one visible-tab read, with no summary or hidden-tab reads.
- Local Cloudflare Worker checks passed for guest Dashboard, Assets, Analytics and Settings, and verified private/no-store and timing headers on protected API failures. No scheduled jobs were triggered.

The embedded test database and local Worker do not reproduce real Hyperdrive, third-party provider latency or production traffic. Authenticated Cloudflare integration and deployed P95/LCP/INP/CLS remain to be measured. No production database changes, commits, pushes or deployments were performed.
