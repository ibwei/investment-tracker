import {
  buildSummary,
  calculateInvestmentMetrics,
  INVESTMENT_STATUSES,
  INVESTMENT_TYPES,
  STATUS_LABELS
} from "@/lib/calculations";

export function normalizeInvestmentRecord(record, referenceDate = new Date(), timeZone = undefined) {
  const normalized = {
    id: record.id,
    project: record.project ?? "",
    assetName: record.assetName ?? record.name ?? "",
    url: record.url ?? "",
    type: record.type ?? "CeDeFi",
    amount: record.amount ?? 0,
    currency: record.currency ?? "USD",
    allocationNote: record.allocationNote ?? record.positionNote ?? "",
    startTime: record.startTime ?? "",
    endTime: record.endTime ?? "",
    aprExpected: record.aprExpected ?? null,
    aprActual: record.aprActual ?? null,
    incomeTotal: record.incomeTotal ?? null,
    incomeDaily: record.incomeDaily ?? null,
    incomeWeekly: record.incomeWeekly ?? null,
    incomeMonthly: record.incomeMonthly ?? null,
    incomeYearly: record.incomeYearly ?? null,
    status: record.status ?? "ONGOING",
    statusLabel: STATUS_LABELS[record.status] ?? record.status ?? "进行中",
    remark: record.remark ?? "",
    isDeleted: Boolean(record.isDeleted ?? record.is_deleted ?? false),
    createdAt: record.createdAt ?? record.created_at ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? record.updated_at ?? new Date().toISOString()
  };

  return {
    ...normalized,
    metrics: calculateInvestmentMetrics(normalized, referenceDate, timeZone)
  };
}

export function buildDashboardSnapshot(records, referenceDate = new Date(), timeZone = undefined) {
  const normalized = records
    .filter((record) => !record.isDeleted && !record.is_deleted)
    .map((record) => normalizeInvestmentRecord(record, referenceDate, timeZone));

  return {
    records: normalized,
    activeRecords: normalized.filter((record) => record.status === "ONGOING"),
    historicalRecords: normalized.filter((record) => record.status !== "ONGOING"),
    summary: buildSummary(normalized),
    meta: {
      investmentTypes: INVESTMENT_TYPES,
      investmentStatuses: INVESTMENT_STATUSES.map((value) => ({
        value,
        label: STATUS_LABELS[value] ?? value
      })),
      generatedAt: new Date().toISOString()
    }
  };
}
