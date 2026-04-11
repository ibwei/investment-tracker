import { prisma } from "@/lib/prisma";
import {
  INVESTMENT_STATUSES,
  isBlank,
  parseDateInput,
  toDateTimeValue,
  toNullableNumber
} from "@/lib/calculations";
import { buildDashboardSnapshot } from "@/lib/snapshot";

function assert(condition, message, status = 400) {
  if (!condition) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
}

function normalizeText(value, fallback = "") {
  return isBlank(value) ? fallback : String(value).trim();
}

function normalizeUrl(value) {
  if (isBlank(value)) {
    return null;
  }

  const text = String(value).trim();

  try {
    return new URL(text).toString();
  } catch {
    throw Object.assign(new Error("请输入有效链接 URL。"), { status: 400 });
  }
}

function normalizeDate(value, { required = false } = {}) {
  const normalized = toDateTimeValue(value);

  if (required) {
    assert(normalized, "开始时间不能为空。");
  }

  return normalized || null;
}

function normalizeStatus(value) {
  const normalized = normalizeText(value, "ONGOING").toUpperCase();
  assert(INVESTMENT_STATUSES.includes(normalized), "状态值不合法。");
  return normalized;
}

function currentTimestamp() {
  return new Date().toISOString();
}

function shouldAutoSettle(record, referenceDate = new Date()) {
  if (record.status !== "ONGOING" || !record.endTime) {
    return false;
  }

  const endDate = parseDateInput(record.endTime);
  return Boolean(endDate) && endDate.getTime() <= referenceDate.getTime();
}

function normalizeInvestmentInput(input, currentRecord = null) {
  const project = normalizeText(input.project ?? currentRecord?.project);
  const assetName = normalizeText(input.assetName ?? currentRecord?.assetName);
  const type = normalizeText(input.type ?? currentRecord?.type ?? "CeDeFi");
  const currency = normalizeText(
    input.currency ?? currentRecord?.currency ?? "USD"
  ).toUpperCase();
  const amount = toNullableNumber(input.amount ?? currentRecord?.amount);
  const startTime = normalizeDate(input.startTime ?? currentRecord?.startTime, {
    required: true
  });
  const endTime = normalizeDate(input.endTime ?? currentRecord?.endTime);
  const status = normalizeStatus(input.status ?? currentRecord?.status ?? "ONGOING");

  assert(project, "项目名称不能为空。");
  assert(assetName, "名称不能为空。");
  assert(type, "类型不能为空。");
  assert(amount !== null && amount >= 0, "投入金额不能为空且不能为负数。");

  return {
    project,
    assetName,
    url: normalizeUrl(input.url ?? currentRecord?.url),
    type,
    amount,
    currency,
    allocationNote: normalizeText(
      input.allocationNote ?? currentRecord?.allocationNote
    ),
    startTime,
    endTime: status === "ONGOING" ? endTime : endTime ?? startTime,
    aprExpected: toNullableNumber(input.aprExpected ?? currentRecord?.aprExpected),
    aprActual: toNullableNumber(input.aprActual ?? currentRecord?.aprActual),
    incomeTotal: toNullableNumber(input.incomeTotal ?? currentRecord?.incomeTotal),
    incomeDaily: toNullableNumber(input.incomeDaily ?? currentRecord?.incomeDaily),
    incomeWeekly: toNullableNumber(input.incomeWeekly ?? currentRecord?.incomeWeekly),
    incomeMonthly: toNullableNumber(input.incomeMonthly ?? currentRecord?.incomeMonthly),
    incomeYearly: toNullableNumber(input.incomeYearly ?? currentRecord?.incomeYearly),
    status,
    remark: normalizeText(input.remark ?? currentRecord?.remark)
  };
}

function mapRecord(record) {
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

function normalizeUserId(userId) {
  const normalized = Number(userId);
  assert(Number.isInteger(normalized) && normalized > 0, "Unauthorized.", 401);
  return normalized;
}

async function fetchRows(userId) {
  return prisma.investment.findMany({
    where: {
      userId: normalizeUserId(userId),
      isDeleted: false
    },
    orderBy: [
      {
        status: "asc"
      },
      {
        endTime: "desc"
      },
      {
        startTime: "desc"
      },
      {
        id: "desc"
      }
    ]
  });
}

async function fetchRowById(id, userId) {
  return prisma.investment.findFirst({
    where: {
      id,
      userId: normalizeUserId(userId)
    }
  });
}

export async function getDashboardSnapshot(userId) {
  const rows = await fetchRows(userId);
  return buildDashboardSnapshot(rows.map(mapRecord));
}

export async function autoSettleMaturedInvestments(referenceDate = new Date()) {
  const candidates = await prisma.investment.findMany({
    where: {
      isDeleted: false,
      status: "ONGOING",
      NOT: {
        endTime: null
      }
    },
    select: {
      id: true,
      endTime: true,
      status: true
    },
    orderBy: [{ id: "asc" }]
  });

  const maturedIds = candidates
    .filter((record) => shouldAutoSettle(record, referenceDate))
    .map((record) => record.id);

  if (maturedIds.length === 0) {
    return {
      checkedCount: candidates.length,
      settledCount: 0,
      settledIds: []
    };
  }

  const updatedAt = currentTimestamp();
  const result = await prisma.investment.updateMany({
    where: {
      id: {
        in: maturedIds
      }
    },
    data: {
      status: "ENDED",
      updatedAt
    }
  });

  return {
    checkedCount: candidates.length,
    settledCount: result.count,
    settledIds: maturedIds
  };
}

export async function createInvestment(userId, input) {
  const normalized = normalizeInvestmentInput(input);
  const now = currentTimestamp();

  const record = await prisma.investment.create({
    data: {
      userId: normalizeUserId(userId),
      project: normalized.project,
      assetName: normalized.assetName,
      url: normalized.url,
      type: normalized.type,
      amount: normalized.amount,
      currency: normalized.currency,
      allocationNote: normalized.allocationNote,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      aprExpected: normalized.aprExpected,
      aprActual: normalized.aprActual,
      incomeTotal: normalized.incomeTotal,
      incomeDaily: normalized.incomeDaily,
      incomeWeekly: normalized.incomeWeekly,
      incomeMonthly: normalized.incomeMonthly,
      incomeYearly: normalized.incomeYearly,
      status: normalized.status,
      remark: normalized.remark,
      createdAt: now,
      updatedAt: now
    }
  });

  return mapRecord(record);
}

export async function updateInvestment(userId, id, input) {
  const normalizedUserId = normalizeUserId(userId);
  const existing = await fetchRowById(id, normalizedUserId);
  assert(existing, "记录不存在。", 404);

  const currentRecord = mapRecord(existing);
  const normalized = normalizeInvestmentInput(input, currentRecord);
  const now = currentTimestamp();

  const record = await prisma.investment.update({
    where: {
      id
    },
    data: {
      project: normalized.project,
      assetName: normalized.assetName,
      url: normalized.url,
      type: normalized.type,
      amount: normalized.amount,
      currency: normalized.currency,
      allocationNote: normalized.allocationNote,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      aprExpected: normalized.aprExpected,
      aprActual: normalized.aprActual,
      incomeTotal: normalized.incomeTotal,
      incomeDaily: normalized.incomeDaily,
      incomeWeekly: normalized.incomeWeekly,
      incomeMonthly: normalized.incomeMonthly,
      incomeYearly: normalized.incomeYearly,
      status: normalized.status,
      remark: normalized.remark,
      updatedAt: now
    }
  });

  return mapRecord(record);
}

export async function finishInvestment(userId, id, input) {
  const existing = await fetchRowById(id, userId);
  assert(existing, "记录不存在。", 404);

  const currentRecord = mapRecord(existing);
  const nextStatus = normalizeStatus(input.status ?? "EARLY_ENDED");
  assert(nextStatus !== "ONGOING", "结束操作必须指定已结束状态。");

  return updateInvestment(userId, id, {
    ...currentRecord,
    ...input,
    status: nextStatus,
    endTime: input.endTime ?? currentRecord.endTime ?? toDateTimeValue(new Date())
  });
}

export async function softDeleteInvestment(userId, id, confirmationText) {
  const normalizedUserId = normalizeUserId(userId);
  const existing = await fetchRowById(id, normalizedUserId);
  assert(existing, "记录不存在。", 404);
  assert(
    normalizeText(confirmationText).toUpperCase() === "DELETE",
    "请输入 DELETE 以确认删除。"
  );

  await prisma.investment.update({
    where: {
      id
    },
    data: {
      isDeleted: true,
      deletedAt: currentTimestamp(),
      updatedAt: currentTimestamp()
    }
  });

  return true;
}

export async function clearAllInvestments(userId) {
  await prisma.investment.deleteMany({
    where: {
      userId: normalizeUserId(userId)
    }
  });
  return getDashboardSnapshot(userId);
}
