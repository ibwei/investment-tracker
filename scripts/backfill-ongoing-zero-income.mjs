import fs from "node:fs";
import pg from "pg";

const { Client } = pg;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) {
    return;
  }

  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function shouldUseSsl(connectionString) {
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") === "disable") {
    return false;
  }

  return !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeTimeZone(value) {
  const timeZone = String(value || "Asia/Shanghai").trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "Asia/Shanghai";
  }
}

function zonedDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayNumber(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function diffCalendarDays(startTime, endTime, timeZone) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  return dayNumber(zonedDateKey(endDate, timeZone)) - dayNumber(zonedDateKey(startDate, timeZone));
}

function snapshotReferenceDate(snapshotDate, timeZone) {
  const date = new Date(`${snapshotDate}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function deriveIncome({ amount, apr, startTime, referenceDate, timeZone }) {
  const dailyIncome = amount > 0 && apr > 0 ? (amount * apr) / 100 / 365 : 0;
  const holdingDays = Math.max(1, diffCalendarDays(startTime, referenceDate, timeZone) || 1);

  return {
    dailyIncome: roundNumber(dailyIncome),
    weeklyIncome: roundNumber(dailyIncome * 7),
    monthlyIncome: roundNumber(dailyIncome * 30),
    yearlyIncome: roundNumber((amount * apr) / 100),
    totalIncome: roundNumber(dailyIncome * holdingDays)
  };
}

function fillZeroOrNull(current, replacement) {
  const value = toNumber(current);
  return value === null || value === 0 ? replacement : value;
}

function hasChanged(row, nextValues) {
  return Object.entries(nextValues).some(([key, value]) => (toNumber(row[key]) ?? 0) !== value);
}

async function backfillInvestments(client) {
  const { rows } = await client.query(`
    select
      investments.id,
      investments.amount,
      investments.apr_expected as "aprExpected",
      investments.apr_actual as "aprActual",
      investments.income_total as "incomeTotal",
      investments.income_daily as "incomeDaily",
      investments.income_weekly as "incomeWeekly",
      investments.income_monthly as "incomeMonthly",
      investments.income_yearly as "incomeYearly",
      investments.start_time as "startTime",
      users.timezone
    from investments
    join users on users.id = investments.user_id
    where investments.is_deleted = false
      and investments.status = 'ONGOING'
      and investments.amount > 0
      and coalesce(investments.apr_expected, investments.apr_actual, 0) > 0
      and (
        coalesce(investments.income_total, 0) = 0
        or coalesce(investments.income_daily, 0) = 0
        or coalesce(investments.income_weekly, 0) = 0
        or coalesce(investments.income_monthly, 0) = 0
        or coalesce(investments.income_yearly, 0) = 0
      )
    order by investments.id asc
  `);

  let updatedCount = 0;
  const updatedIds = [];

  for (const row of rows) {
    const amount = toNumber(row.amount) ?? 0;
    const apr = toNumber(row.aprExpected) ?? toNumber(row.aprActual) ?? 0;
    const timeZone = normalizeTimeZone(row.timezone);
    const derived = deriveIncome({
      amount,
      apr,
      startTime: row.startTime,
      referenceDate: new Date(),
      timeZone
    });
    const nextValues = {
      incomeTotal: fillZeroOrNull(row.incomeTotal, derived.totalIncome),
      incomeDaily: fillZeroOrNull(row.incomeDaily, derived.dailyIncome),
      incomeWeekly: fillZeroOrNull(row.incomeWeekly, derived.weeklyIncome),
      incomeMonthly: fillZeroOrNull(row.incomeMonthly, derived.monthlyIncome),
      incomeYearly: fillZeroOrNull(row.incomeYearly, derived.yearlyIncome)
    };

    if (!hasChanged(row, nextValues)) {
      continue;
    }

    await client.query(
      `
        update investments
        set
          income_total = $1,
          income_daily = $2,
          income_weekly = $3,
          income_monthly = $4,
          income_yearly = $5,
          updated_at = $6
        where id = $7
      `,
      [
        nextValues.incomeTotal,
        nextValues.incomeDaily,
        nextValues.incomeWeekly,
        nextValues.incomeMonthly,
        nextValues.incomeYearly,
        new Date().toISOString(),
        row.id
      ]
    );

    updatedCount += 1;
    updatedIds.push(row.id);
  }

  return { updatedCount, updatedIds };
}

async function backfillInvestmentSnapshots(client) {
  const { rows } = await client.query(`
    select
      investment_daily_snapshots.id,
      investment_daily_snapshots.user_id as "userId",
      investment_daily_snapshots.snapshot_date as "snapshotDate",
      investment_daily_snapshots.principal,
      investment_daily_snapshots.apr_expected as "aprExpected",
      investment_daily_snapshots.apr_actual as "aprActual",
      investment_daily_snapshots.income_total as "incomeTotal",
      investment_daily_snapshots.income_daily as "incomeDaily",
      investment_daily_snapshots.income_weekly as "incomeWeekly",
      investment_daily_snapshots.income_monthly as "incomeMonthly",
      investment_daily_snapshots.income_yearly as "incomeYearly",
      investments.start_time as "startTime",
      users.timezone
    from investment_daily_snapshots
    join investments on investments.id = investment_daily_snapshots.investment_id
    join users on users.id = investment_daily_snapshots.user_id
    where investment_daily_snapshots.status = 'ONGOING'
      and investment_daily_snapshots.principal > 0
      and coalesce(investment_daily_snapshots.apr_expected, investment_daily_snapshots.apr_actual, 0) > 0
      and (
        coalesce(investment_daily_snapshots.income_total, 0) = 0
        or coalesce(investment_daily_snapshots.income_daily, 0) = 0
        or coalesce(investment_daily_snapshots.income_weekly, 0) = 0
        or coalesce(investment_daily_snapshots.income_monthly, 0) = 0
        or coalesce(investment_daily_snapshots.income_yearly, 0) = 0
      )
    order by investment_daily_snapshots.id asc
  `);

  let updatedCount = 0;
  const touchedPortfolioSnapshots = new Set();

  for (const row of rows) {
    const amount = toNumber(row.principal) ?? 0;
    const apr = toNumber(row.aprExpected) ?? toNumber(row.aprActual) ?? 0;
    const timeZone = normalizeTimeZone(row.timezone);
    const derived = deriveIncome({
      amount,
      apr,
      startTime: row.startTime,
      referenceDate: snapshotReferenceDate(row.snapshotDate, timeZone),
      timeZone
    });
    const nextValues = {
      incomeTotal: fillZeroOrNull(row.incomeTotal, derived.totalIncome),
      incomeDaily: fillZeroOrNull(row.incomeDaily, derived.dailyIncome),
      incomeWeekly: fillZeroOrNull(row.incomeWeekly, derived.weeklyIncome),
      incomeMonthly: fillZeroOrNull(row.incomeMonthly, derived.monthlyIncome),
      incomeYearly: fillZeroOrNull(row.incomeYearly, derived.yearlyIncome)
    };

    if (!hasChanged(row, nextValues)) {
      continue;
    }

    await client.query(
      `
        update investment_daily_snapshots
        set
          income_total = $1,
          income_daily = $2,
          income_weekly = $3,
          income_monthly = $4,
          income_yearly = $5
        where id = $6
      `,
      [
        nextValues.incomeTotal,
        nextValues.incomeDaily,
        nextValues.incomeWeekly,
        nextValues.incomeMonthly,
        nextValues.incomeYearly,
        row.id
      ]
    );

    updatedCount += 1;
    touchedPortfolioSnapshots.add(`${row.userId}:${row.snapshotDate}`);
  }

  return { updatedCount, touchedPortfolioSnapshots };
}

async function refreshPortfolioSnapshots(client, touchedPortfolioSnapshots) {
  let refreshedCount = 0;

  for (const key of touchedPortfolioSnapshots) {
    const [userId, snapshotDate] = key.split(":");
    await client.query(
      `
        update portfolio_daily_snapshots
        set
          total_income_daily = coalesce(summary.total_income_daily, 0),
          total_income_weekly = coalesce(summary.total_income_weekly, 0),
          total_income_monthly = coalesce(summary.total_income_monthly, 0),
          total_income_yearly = coalesce(summary.total_income_yearly, 0),
          cumulative_income = coalesce(summary.cumulative_income, 0),
          active_investment_count = coalesce(summary.active_investment_count, 0)
        from (
          select
            sum(income_daily) filter (where status = 'ONGOING') as total_income_daily,
            sum(income_weekly) filter (where status = 'ONGOING') as total_income_weekly,
            sum(income_monthly) filter (where status = 'ONGOING') as total_income_monthly,
            sum(income_yearly) filter (where status = 'ONGOING') as total_income_yearly,
            sum(income_total) as cumulative_income,
            count(*) filter (where status = 'ONGOING') as active_investment_count
          from investment_daily_snapshots
          where user_id = $1 and snapshot_date = $2
        ) summary
        where portfolio_daily_snapshots.user_id = $1
          and portfolio_daily_snapshots.snapshot_date = $2
      `,
      [Number(userId), snapshotDate]
    );
    refreshedCount += 1;
  }

  return refreshedCount;
}

loadDotEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined
});

async function ignoreTimeout(promise, ms) {
  let timeoutId;
  try {
    await Promise.race([
      promise,
      new Promise((resolve) => {
        timeoutId = setTimeout(resolve, ms);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function main() {
  let didBegin = false;

  await client.connect();
  await client.query("begin");
  didBegin = true;

  const investments = await backfillInvestments(client);
  const snapshots = await backfillInvestmentSnapshots(client);
  const refreshedPortfolioSnapshots = await refreshPortfolioSnapshots(
    client,
    snapshots.touchedPortfolioSnapshots
  );

  await client.query("commit");

  console.log(
    JSON.stringify(
      {
        ok: true,
        updatedInvestments: investments.updatedCount,
        updatedInvestmentIds: investments.updatedIds,
        updatedInvestmentSnapshots: snapshots.updatedCount,
        refreshedPortfolioSnapshots
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error) => {
    if (client._connected) {
      await ignoreTimeout(client.query("rollback").catch(() => undefined), 5_000);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await ignoreTimeout(client.end().catch(() => undefined), 5_000);
  });
