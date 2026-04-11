import { prisma } from "@/lib/prisma";
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

function toSnapshotDate(value = new Date(), timeZone) {
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

async function fetchInvestments(userId) {
  return prisma.investment.findMany({
    where: {
      userId: normalizeUserId(userId),
      isDeleted: false
    },
    orderBy: [{ id: "asc" }]
  });
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

export async function captureUserSnapshots(userId, capturedAt = new Date(), timeZoneInput) {
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

  await prisma.$transaction([
    ...normalizedRecords.map((record) =>
      prisma.investmentDailySnapshot.upsert({
        where: {
          investmentId_snapshotDate: {
            investmentId: Number(record.id),
            snapshotDate
          }
        },
        update: {
          userId: normalizedUserId,
          principal: record.metrics.amount,
          aprExpected: record.metrics.expectedApr,
          aprActual: record.metrics.actualApr,
          incomeDaily: record.metrics.dailyIncome,
          incomeWeekly: record.metrics.weeklyIncome,
          incomeMonthly: record.metrics.monthlyIncome,
          incomeYearly: record.metrics.yearlyIncome,
          incomeTotal: record.metrics.totalIncome,
          status: record.status,
          createdAt
        },
        create: {
          userId: normalizedUserId,
          investmentId: Number(record.id),
          snapshotDate,
          principal: record.metrics.amount,
          aprExpected: record.metrics.expectedApr,
          aprActual: record.metrics.actualApr,
          incomeDaily: record.metrics.dailyIncome,
          incomeWeekly: record.metrics.weeklyIncome,
          incomeMonthly: record.metrics.monthlyIncome,
          incomeYearly: record.metrics.yearlyIncome,
          incomeTotal: record.metrics.totalIncome,
          status: record.status,
          createdAt
        }
      })
    ),
    prisma.portfolioDailySnapshot.upsert({
      where: {
        userId_snapshotDate: {
          userId: normalizedUserId,
          snapshotDate
        }
      },
      update: {
        totalPrincipal: portfolio.totalPrincipal,
        portfolioAprExpected: portfolio.portfolioAprExpected,
        portfolioAprActual: portfolio.portfolioAprActual,
        totalIncomeDaily: portfolio.totalIncomeDaily,
        totalIncomeWeekly: portfolio.totalIncomeWeekly,
        totalIncomeMonthly: portfolio.totalIncomeMonthly,
        totalIncomeYearly: portfolio.totalIncomeYearly,
        cumulativeIncome: portfolio.cumulativeIncome,
        activeInvestmentCount: portfolio.activeInvestmentCount,
        createdAt
      },
      create: {
        userId: normalizedUserId,
        snapshotDate,
        totalPrincipal: portfolio.totalPrincipal,
        portfolioAprExpected: portfolio.portfolioAprExpected,
        portfolioAprActual: portfolio.portfolioAprActual,
        totalIncomeDaily: portfolio.totalIncomeDaily,
        totalIncomeWeekly: portfolio.totalIncomeWeekly,
        totalIncomeMonthly: portfolio.totalIncomeMonthly,
        totalIncomeYearly: portfolio.totalIncomeYearly,
        cumulativeIncome: portfolio.cumulativeIncome,
        activeInvestmentCount: portfolio.activeInvestmentCount,
        createdAt
      }
    })
  ]);

  return {
    snapshotDate,
    investmentCount: normalizedRecords.length,
    portfolio
  };
}

export async function captureSnapshotsForRemoteUsers(capturedAt = new Date()) {
  const users = await prisma.user.findMany({
    where: {
      storageMode: "REMOTE"
    },
    select: {
      id: true,
      timezone: true
    },
    orderBy: [{ id: "asc" }]
  });

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

export async function listPortfolioSnapshots(userId, options = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const days = toPositiveInteger(options.days, DEFAULT_SNAPSHOT_DAYS);
  const startDate =
    options.startDate && /^\d{4}-\d{2}-\d{2}$/.test(options.startDate)
      ? options.startDate
      : null;

  const snapshots = await prisma.portfolioDailySnapshot.findMany({
    where: {
      userId: normalizedUserId,
      ...(startDate
        ? {
            snapshotDate: {
              gte: startDate
            }
          }
        : {})
    },
    orderBy: [{ snapshotDate: startDate ? "asc" : "desc" }],
    take: startDate ? undefined : days
  });

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
  return prisma.scheduledJobLog.upsert({
    where: {
      jobName_runDate: {
        jobName,
        runDate
      }
    },
    update: {
      status,
      processedCount,
      durationMs,
      errorMessage,
      startedAt,
      finishedAt,
      createdAt: startedAt ?? toIsoTimestamp()
    },
    create: {
      jobName,
      runDate,
      status,
      processedCount,
      durationMs,
      errorMessage,
      startedAt,
      finishedAt,
      createdAt: startedAt ?? toIsoTimestamp()
    }
  });
}
