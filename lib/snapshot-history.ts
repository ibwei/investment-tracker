import { query, queryOne, withTransaction } from "@/lib/db";
import { normalizeInvestmentRecord } from "@/lib/snapshot";
import { toAppDateKey } from "@/lib/time";
import { getUserTimeZone } from "@/lib/users";

const DEFAULT_SNAPSHOT_DAYS = 90;

function assert(condition, message, status = 400) {
  if (!condition) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
}

function normalizeUserId(userId) {
  const normalized = Number(userId);
  assert(Number.isInteger(normalized) && normalized > 0, "Unauthorized.", 401);
  return normalized;
}

function toSnapshotDate(value = new Date(), timeZone = undefined) {
  return toAppDateKey(value, timeZone);
}

function toIsoTimestamp(value = new Date()) {
  return new Date(value).toISOString();
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function mapRow(record) {
  return {
    id: record.id,
    userId: record.userId,
    project: record.project,
    assetName: record.assetName,
    url: record.url,
    type: record.type,
    amount: record.amount,
    currency: record.currency,
    allocationNote: record.allocationNote,
    startTime: record.startTime,
    endTime: record.endTime,
    aprExpected: record.aprExpected,
    aprActual: record.aprActual,
    incomeTotal: record.incomeTotal,
    incomeDaily: record.incomeDaily,
    incomeWeekly: record.incomeWeekly,
    incomeMonthly: record.incomeMonthly,
    incomeYearly: record.incomeYearly,
    status: record.status,
    remark: record.remark,
    isDeleted: record.isDeleted,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

const INVESTMENT_FIELDS = `
  id,
  user_id as "userId",
  project,
  asset_name as "assetName",
  url,
  type,
  amount,
  currency,
  allocation_note as "allocationNote",
  start_time as "startTime",
  end_time as "endTime",
  apr_expected as "aprExpected",
  apr_actual as "aprActual",
  income_total as "incomeTotal",
  income_daily as "incomeDaily",
  income_weekly as "incomeWeekly",
  income_monthly as "incomeMonthly",
  income_yearly as "incomeYearly",
  status,
  remark,
  is_deleted as "isDeleted",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

const PORTFOLIO_SNAPSHOT_FIELDS = `
  snapshot_date as "snapshotDate",
  total_principal as "totalPrincipal",
  portfolio_apr_expected as "portfolioAprExpected",
  portfolio_apr_actual as "portfolioAprActual",
  total_income_daily as "totalIncomeDaily",
  total_income_weekly as "totalIncomeWeekly",
  total_income_monthly as "totalIncomeMonthly",
  total_income_yearly as "totalIncomeYearly",
  cumulative_income as "cumulativeIncome",
  active_investment_count as "activeInvestmentCount",
  created_at as "createdAt"
`;

async function fetchInvestments(userId) {
  return query(
    `
      select ${INVESTMENT_FIELDS}
      from investments
      where user_id = $1 and is_deleted = false
      order by id asc
    `,
    [normalizeUserId(userId)]
  );
}

function buildPortfolioSnapshotPayload(records, capturedAt, timeZone) {
  const normalizedRecords = records.map((record) =>
    normalizeInvestmentRecord(record, capturedAt, timeZone)
  );
  const activeRecords = normalizedRecords.filter((record) => record.status === "ONGOING");
  const totalPrincipal = activeRecords.reduce(
    (sum, record) => sum + record.metrics.amount,
    0
  );
  const totalIncomeDaily = activeRecords.reduce(
    (sum, record) => sum + record.metrics.dailyIncome,
    0
  );
  const totalIncomeWeekly = activeRecords.reduce(
    (sum, record) => sum + record.metrics.weeklyIncome,
    0
  );
  const totalIncomeMonthly = activeRecords.reduce(
    (sum, record) => sum + record.metrics.monthlyIncome,
    0
  );
  const totalIncomeYearly = activeRecords.reduce(
    (sum, record) => sum + record.metrics.yearlyIncome,
    0
  );
  const cumulativeIncome = normalizedRecords.reduce(
    (sum, record) => sum + record.metrics.totalIncome,
    0
  );
  const weightedAprBase = activeRecords.reduce(
    (sum, record) => sum + record.metrics.amount,
    0
  );
  const portfolioAprExpected =
    weightedAprBase > 0
      ? activeRecords.reduce(
          (sum, record) => sum + record.metrics.expectedApr * record.metrics.amount,
          0
        ) / weightedAprBase
      : 0;
  const portfolioAprActual =
    weightedAprBase > 0
      ? activeRecords.reduce(
          (sum, record) => sum + record.metrics.actualApr * record.metrics.amount,
          0
        ) / weightedAprBase
      : 0;

  return {
    normalizedRecords,
    portfolio: {
      totalPrincipal,
      portfolioAprExpected,
      portfolioAprActual,
      totalIncomeDaily,
      totalIncomeWeekly,
      totalIncomeMonthly,
      totalIncomeYearly,
      cumulativeIncome,
      activeInvestmentCount: activeRecords.length
    }
  };
}

export async function captureUserSnapshots(
  userId,
  capturedAt = new Date(),
  timeZoneInput = undefined
) {
  const normalizedUserId = normalizeUserId(userId);
  const timeZone = timeZoneInput ?? await getUserTimeZone(normalizedUserId);
  const rows = await fetchInvestments(normalizedUserId);
  const snapshotDate = toSnapshotDate(capturedAt, timeZone);
  const createdAt = toIsoTimestamp(capturedAt);
  const mappedRows = rows.map(mapRow);
  const { normalizedRecords, portfolio } = buildPortfolioSnapshotPayload(
    mappedRows,
    capturedAt,
    timeZone
  );

  await withTransaction(async (client) => {
    for (const record of normalizedRecords) {
      await client.query(
        `
          insert into investment_daily_snapshots (
            user_id, investment_id, snapshot_date, principal, apr_expected, apr_actual,
            income_daily, income_weekly, income_monthly, income_yearly, income_total,
            status, created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          on conflict (investment_id, snapshot_date)
          do update set
            user_id = excluded.user_id,
            principal = excluded.principal,
            apr_expected = excluded.apr_expected,
            apr_actual = excluded.apr_actual,
            income_daily = excluded.income_daily,
            income_weekly = excluded.income_weekly,
            income_monthly = excluded.income_monthly,
            income_yearly = excluded.income_yearly,
            income_total = excluded.income_total,
            status = excluded.status,
            created_at = excluded.created_at
        `,
        [
          normalizedUserId,
          Number(record.id),
          snapshotDate,
          record.metrics.amount,
          record.metrics.expectedApr,
          record.metrics.actualApr,
          record.metrics.dailyIncome,
          record.metrics.weeklyIncome,
          record.metrics.monthlyIncome,
          record.metrics.yearlyIncome,
          record.metrics.totalIncome,
          record.status,
          createdAt
        ]
      );
    }

    await client.query(
      `
        insert into portfolio_daily_snapshots (
          user_id, snapshot_date, total_principal, portfolio_apr_expected,
          portfolio_apr_actual, total_income_daily, total_income_weekly,
          total_income_monthly, total_income_yearly, cumulative_income,
          active_investment_count, created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        on conflict (user_id, snapshot_date)
        do update set
          total_principal = excluded.total_principal,
          portfolio_apr_expected = excluded.portfolio_apr_expected,
          portfolio_apr_actual = excluded.portfolio_apr_actual,
          total_income_daily = excluded.total_income_daily,
          total_income_weekly = excluded.total_income_weekly,
          total_income_monthly = excluded.total_income_monthly,
          total_income_yearly = excluded.total_income_yearly,
          cumulative_income = excluded.cumulative_income,
          active_investment_count = excluded.active_investment_count,
          created_at = excluded.created_at
      `,
      [
        normalizedUserId,
        snapshotDate,
        portfolio.totalPrincipal,
        portfolio.portfolioAprExpected,
        portfolio.portfolioAprActual,
        portfolio.totalIncomeDaily,
        portfolio.totalIncomeWeekly,
        portfolio.totalIncomeMonthly,
        portfolio.totalIncomeYearly,
        portfolio.cumulativeIncome,
        portfolio.activeInvestmentCount,
        createdAt
      ]
    );
  });

  return {
    snapshotDate,
    investmentCount: normalizedRecords.length,
    portfolio
  };
}

export async function captureSnapshotsForRemoteUsers(capturedAt = new Date()) {
  const users = await query<{ id: number; timezone: string }>(
    `
      select id, timezone
      from users
      where storage_mode = 'REMOTE'
      order by id asc
    `
  );

  let processedUsers = 0;
  let processedInvestments = 0;

  for (const user of users) {
    const result = await captureUserSnapshots(user.id, capturedAt, user.timezone);
    processedUsers += 1;
    processedInvestments += result.investmentCount;
  }

  return {
    snapshotDate: toSnapshotDate(capturedAt),
    processedUsers,
    processedInvestments
  };
}

export async function listPortfolioSnapshots(
  userId,
  options: { days?: string | number; startDate?: string } = {}
) {
  const normalizedUserId = normalizeUserId(userId);
  const days = toPositiveInteger(options.days, DEFAULT_SNAPSHOT_DAYS);
  const startDate =
    options.startDate && /^\d{4}-\d{2}-\d{2}$/.test(options.startDate)
      ? options.startDate
      : null;

  const snapshots = await query(
    `
      select ${PORTFOLIO_SNAPSHOT_FIELDS}
      from portfolio_daily_snapshots
      where user_id = $1
        ${startDate ? "and snapshot_date >= $2" : ""}
      order by snapshot_date ${startDate ? "asc" : "desc"}
      ${startDate ? "" : "limit $2"}
    `,
    startDate ? [normalizedUserId, startDate] : [normalizedUserId, days]
  );

  const orderedSnapshots = startDate ? snapshots : snapshots.reverse();

  return orderedSnapshots.map((snapshot) => ({
    snapshotDate: snapshot.snapshotDate,
    totalPrincipal: snapshot.totalPrincipal,
    portfolioAprExpected: snapshot.portfolioAprExpected ?? 0,
    portfolioAprActual: snapshot.portfolioAprActual ?? 0,
    totalIncomeDaily: snapshot.totalIncomeDaily ?? 0,
    totalIncomeWeekly: snapshot.totalIncomeWeekly ?? 0,
    totalIncomeMonthly: snapshot.totalIncomeMonthly ?? 0,
    totalIncomeYearly: snapshot.totalIncomeYearly ?? 0,
    cumulativeIncome: snapshot.cumulativeIncome ?? 0,
    activeInvestmentCount: snapshot.activeInvestmentCount ?? 0,
    createdAt: snapshot.createdAt
  }));
}

export async function writeScheduledJobLog({
  jobName,
  runDate,
  status,
  processedCount = 0,
  durationMs = null,
  errorMessage = null,
  startedAt = null,
  finishedAt = null
}) {
  return queryOne(
    `
      insert into scheduled_job_logs (
        job_name, run_date, status, processed_count, duration_ms,
        error_message, started_at, finished_at, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (job_name, run_date)
      do update set
        status = excluded.status,
        processed_count = excluded.processed_count,
        duration_ms = excluded.duration_ms,
        error_message = excluded.error_message,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        created_at = excluded.created_at
      returning *
    `,
    [
      jobName,
      runDate,
      status,
      processedCount,
      durationMs,
      errorMessage,
      startedAt,
      finishedAt,
      startedAt ?? toIsoTimestamp()
    ]
  );
}
