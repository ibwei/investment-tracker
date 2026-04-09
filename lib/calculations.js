const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

export function parseDateInput(value) {
  if (isBlank(value)) {
    return null;
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateInputValue(value) {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return "";
  }

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0")
  ].join("-");
}

export function diffDays(startDate, endDate) {
  if (!startDate || !endDate) {
    return 0;
  }

  const startUtc = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endUtc = Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  return Math.max(0, Math.round((endUtc - startUtc) / MS_PER_DAY));
}

export function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateHoldingDays(record, referenceDate = new Date()) {
  const startDate = parseDateInput(record.startTime);
  const endDate =
    parseDateInput(record.endTime) ??
    (record.status === "ONGOING" ? referenceDate : null);

  if (!startDate || !endDate) {
    return 0;
  }

  return Math.max(1, diffDays(startDate, endDate) || 1);
}

export function calculateInvestmentMetrics(record, referenceDate = new Date()) {
  const amount = toNullableNumber(record.amount) ?? 0;
  const expectedApr = toNullableNumber(record.aprExpected) ?? 0;
  const actualAprInput = toNullableNumber(record.aprActual);
  const holdingDays = calculateHoldingDays(record, referenceDate);

  const manualTotal = toNullableNumber(record.incomeTotal);
  const derivedActualAprFromTotal =
    manualTotal !== null && amount > 0 && holdingDays > 0
      ? (manualTotal / amount) * (365 / holdingDays) * 100
      : null;

  const effectiveActualApr =
    actualAprInput ?? derivedActualAprFromTotal ?? expectedApr;

  const autoDaily =
    amount > 0 && effectiveActualApr
      ? (amount * effectiveActualApr) / 100 / 365
      : 0;

  const dailyIncome =
    toNullableNumber(record.incomeDaily) ??
    (manualTotal !== null && holdingDays > 0 ? manualTotal / holdingDays : autoDaily);

  const weeklyIncome =
    toNullableNumber(record.incomeWeekly) ?? dailyIncome * 7;
  const monthlyIncome =
    toNullableNumber(record.incomeMonthly) ?? dailyIncome * 30;
  const yearlyIncome =
    toNullableNumber(record.incomeYearly) ?? (amount * effectiveActualApr) / 100;
  const totalIncome =
    manualTotal ?? dailyIncome * Math.max(holdingDays, 1);

  const roi = amount > 0 ? (totalIncome / amount) * 100 : 0;

  return {
    amount: roundNumber(amount),
    holdingDays,
    expectedApr: roundNumber(expectedApr),
    actualApr: roundNumber(effectiveActualApr),
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
          (total, record) => total + record.metrics.actualApr * record.metrics.amount,
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
