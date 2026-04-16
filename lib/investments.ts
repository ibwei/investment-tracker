import {
  INVESTMENT_STATUSES,
  isBlank,
  parseDateInput,
  toNullableNumber
} from "@/lib/calculations";
import { execute, query, queryOne } from "@/lib/db";
import { buildDashboardSnapshot } from "@/lib/snapshot";
import { toUtcISOString } from "@/lib/time";
import { getUserTimeZone } from "@/lib/users";

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

function normalizeDate(value, { required = false, timeZone = undefined } = {}) {
  const normalized = toUtcISOString(value, timeZone);

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

function normalizeInvestmentInput(input, currentRecord = null, timeZone) {
  const project = normalizeText(input.project ?? currentRecord?.project);
  const assetName = normalizeText(input.assetName ?? currentRecord?.assetName);
  const type = normalizeText(input.type ?? currentRecord?.type ?? "CeDeFi");
  const currency = normalizeText(
    input.currency ?? currentRecord?.currency ?? "USD"
  ).toUpperCase();
  const amount = toNullableNumber(input.amount ?? currentRecord?.amount);
  const startTime = normalizeDate(input.startTime ?? currentRecord?.startTime, {
    required: true,
    timeZone
  });
  const endTime = normalizeDate(input.endTime ?? currentRecord?.endTime, { timeZone });
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

function normalizeUserId(userId) {
  const normalized = Number(userId);
  assert(Number.isInteger(normalized) && normalized > 0, "Unauthorized.", 401);
  return normalized;
}

function readFreshnessKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchRows(userId) {
  const freshnessKey = readFreshnessKey();

  return query(
    `
      /* investment-read:${freshnessKey} */
      select ${INVESTMENT_FIELDS}
      from investments
      where user_id = $1 and is_deleted = false
      order by status asc, end_time desc nulls last, start_time desc, id desc
    `,
    [normalizeUserId(userId)]
  );
}

async function fetchRowById(id, userId) {
  const freshnessKey = readFreshnessKey();

  return queryOne(
    `
      /* investment-row-read:${freshnessKey} */
      select ${INVESTMENT_FIELDS}
      from investments
      where id = $1 and user_id = $2
      limit 1
    `,
    [id, normalizeUserId(userId)]
  );
}

export async function getDashboardSnapshot(userId) {
  const timeZone = await getUserTimeZone(userId);
  const rows = await fetchRows(userId);
  return buildDashboardSnapshot(rows.map(mapRecord), new Date(), timeZone);
}

export async function autoSettleMaturedInvestments(referenceDate = new Date()) {
  const candidates = await query<{ id: number; endTime: string | null; status: string }>(
    `
      select id, end_time as "endTime", status
      from investments
      where is_deleted = false and status = 'ONGOING' and end_time is not null
      order by id asc
    `
  );

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
  const result = await execute(
    `
      update investments
      set status = 'ENDED', updated_at = $2
      where id = any($1::int[])
    `,
    [maturedIds, updatedAt]
  );

  return {
    checkedCount: candidates.length,
    settledCount: result.rowCount ?? 0,
    settledIds: maturedIds
  };
}

export async function createInvestment(userId, input) {
  const timeZone = await getUserTimeZone(userId);
  const normalized = normalizeInvestmentInput(input, null, timeZone);
  const now = currentTimestamp();

  const record = await queryOne(
    `
      insert into investments (
        user_id, project, asset_name, url, type, amount, currency, allocation_note,
        start_time, end_time, apr_expected, apr_actual, income_total, income_daily,
        income_weekly, income_monthly, income_yearly, status, remark, created_at, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $20
      )
      returning ${INVESTMENT_FIELDS}
    `,
    [
      normalizeUserId(userId),
      normalized.project,
      normalized.assetName,
      normalized.url,
      normalized.type,
      normalized.amount,
      normalized.currency,
      normalized.allocationNote,
      normalized.startTime,
      normalized.endTime,
      normalized.aprExpected,
      normalized.aprActual,
      normalized.incomeTotal,
      normalized.incomeDaily,
      normalized.incomeWeekly,
      normalized.incomeMonthly,
      normalized.incomeYearly,
      normalized.status,
      normalized.remark,
      now
    ]
  );

  return mapRecord(record);
}

export async function updateInvestment(userId, id, input) {
  const normalizedUserId = normalizeUserId(userId);
  const existing = await fetchRowById(id, normalizedUserId);
  assert(existing, "记录不存在。", 404);

  const currentRecord = mapRecord(existing);
  const timeZone = await getUserTimeZone(userId);
  const normalized = normalizeInvestmentInput(input, currentRecord, timeZone);
  const now = currentTimestamp();

  const record = await queryOne(
    `
      update investments
      set
        project = $1,
        asset_name = $2,
        url = $3,
        type = $4,
        amount = $5,
        currency = $6,
        allocation_note = $7,
        start_time = $8,
        end_time = $9,
        apr_expected = $10,
        apr_actual = $11,
        income_total = $12,
        income_daily = $13,
        income_weekly = $14,
        income_monthly = $15,
        income_yearly = $16,
        status = $17,
        remark = $18,
        updated_at = $19
      where id = $20 and user_id = $21
      returning ${INVESTMENT_FIELDS}
    `,
    [
      normalized.project,
      normalized.assetName,
      normalized.url,
      normalized.type,
      normalized.amount,
      normalized.currency,
      normalized.allocationNote,
      normalized.startTime,
      normalized.endTime,
      normalized.aprExpected,
      normalized.aprActual,
      normalized.incomeTotal,
      normalized.incomeDaily,
      normalized.incomeWeekly,
      normalized.incomeMonthly,
      normalized.incomeYearly,
      normalized.status,
      normalized.remark,
      now,
      id,
      normalizedUserId
    ]
  );

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
    endTime: input.endTime ?? currentRecord.endTime ?? toUtcISOString(new Date())
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

  const timestamp = currentTimestamp();
  await execute(
    `
      update investments
      set is_deleted = true, deleted_at = $1, updated_at = $1
      where id = $2 and user_id = $3
    `,
    [timestamp, id, normalizedUserId]
  );

  return true;
}

export async function clearAllInvestments(userId) {
  await execute(`delete from investments where user_id = $1`, [normalizeUserId(userId)]);
  return getDashboardSnapshot(userId);
}
