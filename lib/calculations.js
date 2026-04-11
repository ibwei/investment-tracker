import {
  diffAppCalendarDays,
  parseAppDate,
  toInputDateTimeValue
} from "@/lib/time";

export const INVESTMENT_TYPES = ["Interest", "LP", "Lending", "CeDeFi"];

export const INVESTMENT_STATUSES = [
  "ONGOING",
  "ENDED",
  "EARLY_ENDED"
];

export const STATUS_LABELS = {
  ONGOING: "进行中",
  ENDED: "已结束",
  EARLY_ENDED: "提前结束"
};

export function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function toNullableNumber(value) {
  if (isBlank(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDateInput(value, timeZone) {
  const parsed = parseAppDate(value, timeZone);
  return parsed ? parsed.toDate() : null;
}

export function toDateInputValue(value, timeZone) {
  return toInputDateTimeValue(value, timeZone).slice(0, 10);
}

export function toDateTimeValue(value, timeZone) {
  return toInputDateTimeValue(value, timeZone);
}

export function diffDays(startDate, endDate, timeZone) {
  return diffAppCalendarDays(startDate, endDate, timeZone);
}

export function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateHoldingDays(record, referenceDate = new Date(), timeZone) {
  const startDate = parseDateInput(record.startTime, timeZone);
  const endDate =
    parseDateInput(record.endTime, timeZone) ??
    (record.status === "ONGOING" ? referenceDate : null);

  if (!startDate || !endDate) {
    return 0;
  }

  return Math.max(1, diffDays(startDate, endDate, timeZone) || 1);
}

function calculatePlannedDays(record, timeZone) {
  const startDate = parseDateInput(record.startTime, timeZone);
  const endDate = parseDateInput(record.endTime, timeZone);

  if (!startDate || !endDate) {
    return null;
  }

  return Math.max(1, diffDays(startDate, endDate, timeZone) || 1);
}

export function calculateInvestmentMetrics(record, referenceDate = new Date(), timeZone) {
  const amount = toNullableNumber(record.amount) ?? 0;
  const expectedApr = toNullableNumber(record.aprExpected) ?? 0;
  const actualAprInput = toNullableNumber(record.aprActual);
  const holdingDays = calculateHoldingDays(record, referenceDate, timeZone);
  const plannedDays = calculatePlannedDays(record, timeZone);
  const isOngoing = record.status === "ONGOING";

  const manualTotal = toNullableNumber(record.incomeTotal);
  const derivedActualAprFromTotal =
    !isOngoing && manualTotal !== null && amount > 0 && holdingDays > 0
      ? (manualTotal / amount) * (365 / holdingDays) * 100
      : null;

  const effectiveApr = isOngoing
    ? expectedApr
    : actualAprInput ?? derivedActualAprFromTotal ?? expectedApr;

  const autoDaily =
    amount > 0 && effectiveApr
      ? (amount * effectiveApr) / 100 / 365
      : 0;
  const incomePeriodDays =
    manualTotal !== null && isOngoing
      ? plannedDays ?? holdingDays
      : holdingDays;

  const dailyIncome =
    toNullableNumber(record.incomeDaily) ??
    (manualTotal !== null && incomePeriodDays > 0 ? manualTotal / incomePeriodDays : autoDaily);

  const weeklyIncome =
    toNullableNumber(record.incomeWeekly) ?? dailyIncome * 7;
  const monthlyIncome =
    toNullableNumber(record.incomeMonthly) ?? dailyIncome * 30;
  const yearlyIncome =
    toNullableNumber(record.incomeYearly) ?? (amount * effectiveApr) / 100;
  const totalIncome =
    manualTotal ?? dailyIncome * Math.max(holdingDays, 1);

  const roi = amount > 0 ? (totalIncome / amount) * 100 : 0;

  return {
    amount: roundNumber(amount),
    holdingDays,
    expectedApr: roundNumber(expectedApr),
    actualApr: roundNumber(effectiveApr),
    dailyIncome: roundNumber(dailyIncome),
    weeklyIncome: roundNumber(weeklyIncome),
    monthlyIncome: roundNumber(monthlyIncome),
    yearlyIncome: roundNumber(yearlyIncome),
    totalIncome: roundNumber(totalIncome),
    roi: roundNumber(roi),
    statusLabel: STATUS_LABELS[record.status] ?? record.status
  };
}

export function buildSummary(records) {
  const activeRecords = records.filter((record) => record.status === "ONGOING");
  const historicalRecords = records.filter((record) => record.status !== "ONGOING");

  const deployedCapital = activeRecords.reduce(
    (total, record) => total + record.metrics.amount,
    0
  );
  const totalIncome = records.reduce(
    (total, record) => total + record.metrics.totalIncome,
    0
  );
  const activeDailyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.dailyIncome,
    0
  );
  const activeWeeklyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.weeklyIncome,
    0
  );
  const activeMonthlyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.monthlyIncome,
    0
  );
  const activeYearlyIncome = activeRecords.reduce(
    (total, record) => total + record.metrics.yearlyIncome,
    0
  );

  const weightedAprBase = activeRecords.reduce(
    (total, record) => total + record.metrics.amount,
    0
  );

  const weightedActualApr =
    weightedAprBase > 0
      ? activeRecords.reduce(
          (total, record) => total + record.metrics.expectedApr * record.metrics.amount,
          0
        ) / weightedAprBase
      : 0;

  return {
    activeCount: activeRecords.length,
    historicalCount: historicalRecords.length,
    deployedCapital: roundNumber(deployedCapital),
    totalIncome: roundNumber(totalIncome),
    activeDailyIncome: roundNumber(activeDailyIncome),
    activeWeeklyIncome: roundNumber(activeWeeklyIncome),
    activeMonthlyIncome: roundNumber(activeMonthlyIncome),
    activeYearlyIncome: roundNumber(activeYearlyIncome),
    weightedActualApr: roundNumber(weightedActualApr)
  };
}
