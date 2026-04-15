import { execute, query, queryOne, withConnection, withTransaction } from "@/lib/db";
import { toAppDateKey } from "@/lib/time";
import type {
  AssetBalanceRecord,
  AssetPositionRecord,
  AssetSnapshotRecord,
  AssetSourceRecord,
  AssetSummaryResponse,
  AssetSyncLogRecord,
  ManualAssetRecord,
  NormalizedAssetBalance,
  NormalizedAssetPosition,
} from "@/lib/assets/types";
import { decryptAssetConfig, encryptAssetConfig } from "@/lib/assets/encryption";
import { AssetProviderError, getCexAdapter, getOnchainAdapter } from "@/lib/assets/adapters";

const DEFAULT_LIMIT = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SOURCES_PER_USER = 10;
const MAX_MANUAL_ASSETS_PER_USER = 50;

const SOURCE_FIELDS = `
  id,
  user_id as "userId",
  type,
  provider,
  name,
  public_ref as "publicRef",
  status,
  last_synced_at as "lastSyncedAt",
  last_error as "lastError",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

const BALANCE_FIELDS = `
  asset_balances.id,
  asset_balances.user_id as "userId",
  asset_balances.source_id as "sourceId",
  asset_sources.name as "sourceName",
  asset_sources.type as "sourceType",
  asset_symbol as "assetSymbol",
  asset_name as "assetName",
  amount,
  value_usd as "valueUsd",
  category,
  asset_balances.updated_at as "updatedAt"
`;

const POSITION_FIELDS = `
  asset_positions.id,
  asset_positions.user_id as "userId",
  asset_positions.source_id as "sourceId",
  asset_sources.name as "sourceName",
  asset_sources.type as "sourceType",
  asset_positions.provider,
  asset_positions.chain,
  asset_positions.protocol_id as "protocolId",
  asset_positions.protocol_name as "protocolName",
  asset_positions.position_type as "positionType",
  asset_positions.asset_value_usd as "assetValueUsd",
  asset_positions.debt_value_usd as "debtValueUsd",
  asset_positions.reward_value_usd as "rewardValueUsd",
  asset_positions.net_value_usd as "netValueUsd",
  asset_positions.updated_at as "updatedAt"
`;

const MANUAL_FIELDS = `
  id,
  user_id as "userId",
  name,
  type,
  amount,
  value_usd as "valueUsd",
  note,
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

const SNAPSHOT_FIELDS = `
  snapshot_date as "snapshotDate",
  total_value_usd as "totalValueUsd",
  breakdown,
  created_at as "createdAt"
`;

const SYNC_LOG_FIELDS = `
  asset_sync_logs.id,
  asset_sync_logs.user_id as "userId",
  asset_sync_logs.source_id as "sourceId",
  asset_sources.name as "sourceName",
  asset_sync_logs.status,
  asset_sync_logs.balance_count as "balanceCount",
  asset_sync_logs.duration_ms as "durationMs",
  asset_sync_logs.error_message as "errorMessage",
  asset_sync_logs.started_at as "startedAt",
  asset_sync_logs.finished_at as "finishedAt",
  asset_sync_logs.created_at as "createdAt"
`;

const SYNC_SOURCE_FIELDS = `
  id,
  user_id as "userId",
  type,
  provider,
  name,
  public_ref as "publicRef",
  encrypted_config as "encryptedConfig",
  status,
  last_synced_at as "lastSyncedAt",
  last_error as "lastError",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) {
    const error = new Error(message) as Error & { status?: number };
    error.status = status;
    throw error;
  }
}

function now() {
  return new Date().toISOString();
}

function normalizeUserId(userId: number | string) {
  const normalized = Number(userId);
  assert(Number.isInteger(normalized) && normalized > 0, "Unauthorized.", 401);
  return normalized;
}

function normalizeText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeOptionalText(value: unknown) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeNumber(value: unknown, { min = 0, field = "Value" } = {}) {
  const parsed = Number(value);
  assert(Number.isFinite(parsed), `${field} is required.`);
  assert(parsed >= min, `${field} must be greater than or equal to ${min}.`);
  return parsed;
}

function toPositiveInteger(value: unknown, fallback = DEFAULT_LIMIT) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_PAGE_SIZE);
}

function toOffset(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function toSnapshotDate(value = new Date()) {
  return toAppDateKey(value);
}

function parseBreakdown(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapSnapshot(record: AssetSnapshotRecord & { breakdown?: string | null }) {
  return {
    snapshotDate: record.snapshotDate,
    totalValueUsd: Number(record.totalValueUsd ?? 0),
    breakdown: parseBreakdown((record as { breakdown?: string | null }).breakdown ?? null),
    createdAt: record.createdAt,
  };
}

function getSourceSort(sort?: string | null) {
  switch (sort) {
    case "lastSyncedAt.asc":
      return `asset_sources.last_synced_at asc nulls last, asset_sources.id asc`;
    case "name.asc":
      return `asset_sources.name asc, asset_sources.id asc`;
    default:
      return `asset_sources.updated_at desc, asset_sources.id desc`;
  }
}

function getBalanceSort(sort?: string | null) {
  switch (sort) {
    case "assetSymbol.asc":
      return `asset_symbol asc, asset_balances.id asc`;
    case "updatedAt.desc":
      return `asset_balances.updated_at desc, asset_balances.id desc`;
    default:
      return `value_usd desc, asset_balances.id desc`;
  }
}

function getPositionSort(sort?: string | null) {
  switch (sort) {
    case "updatedAt.desc":
      return `asset_positions.updated_at desc, asset_positions.id desc`;
    default:
      return `net_value_usd desc, asset_positions.id desc`;
  }
}

function buildCategoryBreakdown(values: Array<{ category: string; valueUsd: number }>, total: number) {
  return values
    .filter((item) => item.valueUsd > 0)
    .sort((left, right) => right.valueUsd - left.valueUsd)
    .map((item) => ({
      category: item.category,
      valueUsd: item.valueUsd,
      percentage: total > 0 ? Number(((item.valueUsd / total) * 100).toFixed(2)) : 0,
    }));
}

function buildSourceTypeBreakdown(values: Record<"CEX" | "ONCHAIN" | "MANUAL", number>, total: number) {
  return (Object.entries(values) as Array<["CEX" | "ONCHAIN" | "MANUAL", number]>)
    .filter(([, valueUsd]) => valueUsd > 0)
    .map(([type, valueUsd]) => ({
      type,
      valueUsd,
      percentage: total > 0 ? Number(((valueUsd / total) * 100).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.valueUsd - left.valueUsd);
}

function summarizeTopAssets(
  balances: AssetBalanceRecord[],
  positions: AssetPositionRecord[],
  manualAssets: ManualAssetRecord[]
) {
  type SourceType = "CEX" | "ONCHAIN" | "MANUAL";
  type SourceGroup = {
    label: string;
    sourceId: number | null;
    sourceName: string;
    sourceType: SourceType;
    valueUsd: number;
    categories: Set<string>;
    balanceCount: number;
    positionCount: number;
    manualAssetCount: number;
  };

  const groups = new Map<string, SourceGroup>();

  function addItem({
    key,
    label,
    category,
    sourceType,
    sourceId,
    sourceName,
    valueUsd,
    itemType,
  }: {
    key: string;
    label: string;
    category: string;
    sourceType: SourceType;
    sourceId: number | null;
    sourceName: string;
    valueUsd: number;
    itemType: "BALANCE" | "POSITION" | "MANUAL";
  }) {
    if (valueUsd <= 0) {
      return;
    }

    const group = groups.get(key) ?? {
      label,
      sourceId,
      sourceName,
      sourceType,
      valueUsd: 0,
      categories: new Set<string>(),
      balanceCount: 0,
      positionCount: 0,
      manualAssetCount: 0,
    };

    group.valueUsd += valueUsd;
    group.categories.add(category);
    if (itemType === "BALANCE") {
      group.balanceCount += 1;
    }
    if (itemType === "POSITION") {
      group.positionCount += 1;
    }
    if (itemType === "MANUAL") {
      group.manualAssetCount += 1;
    }
    groups.set(key, group);
  }

  for (const item of balances) {
    if (item.category === "DETAIL") {
      continue;
    }

    addItem({
      key: `source:${item.sourceId}`,
      label: item.sourceName ?? "Unknown source",
      category: item.category,
      sourceType: item.sourceType ?? "CEX",
      sourceId: item.sourceId,
      sourceName: item.sourceName ?? "Unknown source",
      valueUsd: Number(item.valueUsd ?? 0),
      itemType: "BALANCE",
    });
  }

  for (const item of positions) {
    addItem({
      key: `source:${item.sourceId}`,
      label: item.sourceName ?? "Unknown source",
      category: item.positionType,
      sourceType: item.sourceType ?? "ONCHAIN",
      sourceId: item.sourceId,
      sourceName: item.sourceName ?? "Unknown source",
      valueUsd: Number(item.netValueUsd ?? 0),
      itemType: "POSITION",
    });
  }

  for (const item of manualAssets) {
    addItem({
      key: "manual",
      label: "Manual",
      category: item.type,
      sourceType: "MANUAL",
      sourceId: null,
      sourceName: "Manual",
      valueUsd: Number(item.valueUsd ?? 0),
      itemType: "MANUAL",
    });
  }

  return Array.from(groups.values())
    .map((item) => {
      const categories = Array.from(item.categories);

      return {
        label: item.label,
        category: categories.join(" / "),
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        categories,
        sourceTypes: [item.sourceType],
        valueUsd: item.valueUsd,
        balanceCount: item.balanceCount,
        positionCount: item.positionCount,
        manualAssetCount: item.manualAssetCount,
      };
    })
    .sort((left, right) => right.valueUsd - left.valueUsd)
    .slice(0, 5);
}

async function countActiveSources(userId: number) {
  const result = await queryOne<{ count: string }>(
    `select count(*)::text as count from asset_sources where user_id = $1`,
    [userId]
  );
  return Number(result?.count ?? 0);
}

async function countActiveManualAssets(userId: number) {
  const result = await queryOne<{ count: string }>(
    `select count(*)::text as count from manual_assets where user_id = $1 and is_deleted = false`,
    [userId]
  );
  return Number(result?.count ?? 0);
}

async function listAllActiveManualAssets(userId: number) {
  return query<ManualAssetRecord>(
    `
      select ${MANUAL_FIELDS}
      from manual_assets
      where user_id = $1 and is_deleted = false
      order by updated_at desc, id desc
    `,
    [userId]
  );
}

async function listAllBalances(userId: number) {
  return query<AssetBalanceRecord>(
    `
      select ${BALANCE_FIELDS}
      from asset_balances
      join asset_sources on asset_sources.id = asset_balances.source_id
      where asset_balances.user_id = $1
      order by value_usd desc, asset_balances.id desc
    `,
    [userId]
  );
}

async function listAllPositions(userId: number) {
  return query<AssetPositionRecord>(
    `
      select ${POSITION_FIELDS}
      from asset_positions
      join asset_sources on asset_sources.id = asset_positions.source_id
      where asset_positions.user_id = $1
      order by net_value_usd desc, asset_positions.id desc
    `,
    [userId]
  );
}

function isCountedBalance(item: { category?: string | null }) {
  return item.category !== "DETAIL";
}

function countedBalanceValue(item: { category?: string | null; valueUsd?: number | string | null }) {
  return isCountedBalance(item) ? Number(item.valueUsd ?? 0) : 0;
}

async function findSource(userId: number, sourceId: number) {
  return queryOne<AssetSourceRecord>(
    `
      select ${SOURCE_FIELDS}
      from asset_sources
      where user_id = $1 and id = $2
      limit 1
    `,
    [userId, sourceId]
  );
}

async function findSyncSource(userId: number, sourceId: number) {
  return queryOne<AssetSourceRecord & { encryptedConfig: string | null }>(
    `
      select ${SYNC_SOURCE_FIELDS}
      from asset_sources
      where user_id = $1 and id = $2
      limit 1
    `,
    [userId, sourceId]
  );
}

async function writeSyncLog({
  userId,
  sourceId,
  status,
  balanceCount = 0,
  durationMs = null,
  errorMessage = null,
  startedAt = null,
  finishedAt = null,
}: {
  userId: number;
  sourceId: number | null;
  status: string;
  balanceCount?: number;
  durationMs?: number | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}) {
  await queryOne(
    `
      insert into asset_sync_logs (
        user_id, source_id, status, balance_count, duration_ms, error_message,
        started_at, finished_at, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id
    `,
    [userId, sourceId, status, balanceCount, durationMs, errorMessage, startedAt, finishedAt, now()]
  );
}

async function replaceSourceBalances(
  client: { query: (text: string, params?: readonly unknown[]) => Promise<unknown> },
  userId: number,
  sourceId: number,
  balances: NormalizedAssetBalance[],
  updatedAt: string
) {
  await client.query(`delete from asset_balances where user_id = $1 and source_id = $2`, [
    userId,
    sourceId,
  ]);

  for (const balance of balances) {
    await client.query(
      `
        insert into asset_balances (
          user_id, source_id, asset_symbol, asset_name, amount, value_usd,
          category, raw_data, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        userId,
        sourceId,
        balance.assetSymbol,
        balance.assetName ?? null,
        balance.amount,
        balance.valueUsd,
        balance.category,
        balance.rawData ? JSON.stringify(balance.rawData) : null,
        updatedAt,
      ]
    );
  }
}

async function replaceSourcePositions(
  client: { query: (text: string, params?: readonly unknown[]) => Promise<unknown> },
  userId: number,
  sourceId: number,
  positions: NormalizedAssetPosition[],
  updatedAt: string
) {
  await client.query(`delete from asset_positions where user_id = $1 and source_id = $2`, [
    userId,
    sourceId,
  ]);

  for (const position of positions) {
    await client.query(
      `
        insert into asset_positions (
          user_id, source_id, provider, chain, protocol_id, protocol_name,
          position_type, asset_value_usd, debt_value_usd, reward_value_usd,
          net_value_usd, raw_data, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        userId,
        sourceId,
        position.provider,
        position.chain ?? null,
        position.protocolId ?? null,
        position.protocolName ?? null,
        position.positionType,
        position.assetValueUsd,
        position.debtValueUsd,
        position.rewardValueUsd,
        position.netValueUsd,
        position.rawData ? JSON.stringify(position.rawData) : null,
        updatedAt,
      ]
    );
  }
}

export async function captureAssetSnapshot(userId: number, capturedAt = new Date()) {
  const normalizedUserId = normalizeUserId(userId);
  const balances = await listAllBalances(normalizedUserId);
  const positions = await listAllPositions(normalizedUserId);
  const manualAssets = await listAllActiveManualAssets(normalizedUserId);
  const snapshotDate = toSnapshotDate(capturedAt);
  const createdAt = new Date(capturedAt).toISOString();

  const totalValueUsd =
    balances.reduce((sum, item) => sum + countedBalanceValue(item), 0) +
    positions.reduce((sum, item) => sum + Number(item.netValueUsd ?? 0), 0) +
    manualAssets.reduce((sum, item) => sum + Number(item.valueUsd ?? 0), 0);

  const sourceTypeTotals = { CEX: 0, ONCHAIN: 0, MANUAL: 0 } as Record<
    "CEX" | "ONCHAIN" | "MANUAL",
    number
  >;
  const categoryTotals = new Map<string, number>();

  for (const balance of balances) {
    if (!isCountedBalance(balance)) {
      continue;
    }

    if (balance.sourceType) {
      sourceTypeTotals[balance.sourceType] += Number(balance.valueUsd ?? 0);
    }
    categoryTotals.set(
      balance.category,
      Number(categoryTotals.get(balance.category) ?? 0) + Number(balance.valueUsd ?? 0)
    );
  }

  for (const position of positions) {
    if (position.sourceType) {
      sourceTypeTotals[position.sourceType] += Number(position.netValueUsd ?? 0);
    }
    categoryTotals.set(
      position.positionType,
      Number(categoryTotals.get(position.positionType) ?? 0) + Number(position.netValueUsd ?? 0)
    );
  }

  for (const asset of manualAssets) {
    sourceTypeTotals.MANUAL += Number(asset.valueUsd ?? 0);
    categoryTotals.set(
      asset.type,
      Number(categoryTotals.get(asset.type) ?? 0) + Number(asset.valueUsd ?? 0)
    );
  }

  const breakdown = JSON.stringify({
    bySourceType: sourceTypeTotals,
    byCategory: Object.fromEntries(categoryTotals.entries()),
    manualAssetsValueUsd: manualAssets.reduce((sum, item) => sum + Number(item.valueUsd ?? 0), 0),
    manualAssetsCount: manualAssets.length,
    totalNetValueUsd: totalValueUsd,
  });

  const snapshot = await queryOne<AssetSnapshotRecord & { breakdown?: string | null }>(
    `
      insert into asset_snapshots (
        user_id, snapshot_date, total_value_usd, breakdown, created_at
      )
      values ($1, $2, $3, $4, $5)
      on conflict (user_id, snapshot_date)
      do update set
        total_value_usd = excluded.total_value_usd,
        breakdown = excluded.breakdown,
        created_at = excluded.created_at
      returning ${SNAPSHOT_FIELDS}
    `,
    [normalizedUserId, snapshotDate, totalValueUsd, breakdown, createdAt]
  );

  return mapSnapshot(snapshot);
}

export async function listAssetSnapshots(
  userId: number,
  options: { days?: string | null; startDate?: string | null; endDate?: string | null } = {}
) {
  const normalizedUserId = normalizeUserId(userId);
  const days = toPositiveInteger(options.days ?? 30, 30);
  const endDate = normalizeText(options.endDate, toSnapshotDate());
  const startDate =
    normalizeText(options.startDate) ||
    new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await query<AssetSnapshotRecord & { breakdown?: string | null }>(
    `
      select ${SNAPSHOT_FIELDS}
      from asset_snapshots
      where user_id = $1 and snapshot_date >= $2 and snapshot_date <= $3
      order by snapshot_date asc
    `,
    [normalizedUserId, startDate, endDate]
  );

  return rows.map(mapSnapshot);
}

export async function getAssetSummary(userId: number): Promise<AssetSummaryResponse> {
  const normalizedUserId = normalizeUserId(userId);
  const { sources, balances, positions, manualAssets, snapshots } = await withConnection(
    async (client) => {
      const sourcesResult = await client.query<AssetSourceRecord>(
      `
        select ${SOURCE_FIELDS}
        from asset_sources
        where user_id = $1
        order by updated_at desc, id desc
      `,
      [normalizedUserId]
      );
      const balancesResult = await client.query<AssetBalanceRecord>(
        `
          select ${BALANCE_FIELDS}
          from asset_balances
          join asset_sources on asset_sources.id = asset_balances.source_id
          where asset_balances.user_id = $1
          order by value_usd desc, asset_balances.id desc
        `,
        [normalizedUserId]
      );
      const positionsResult = await client.query<AssetPositionRecord>(
        `
          select ${POSITION_FIELDS}
          from asset_positions
          join asset_sources on asset_sources.id = asset_positions.source_id
          where asset_positions.user_id = $1
          order by net_value_usd desc, asset_positions.id desc
        `,
        [normalizedUserId]
      );
      const manualAssetsResult = await client.query<ManualAssetRecord>(
        `
          select ${MANUAL_FIELDS}
          from manual_assets
          where user_id = $1 and is_deleted = false
          order by updated_at desc, id desc
        `,
        [normalizedUserId]
      );
      const snapshotsResult = await client.query<AssetSnapshotRecord>(
        `
          select ${SNAPSHOT_FIELDS}
          from asset_snapshots
          where user_id = $1
          order by snapshot_date desc
          limit 2
        `,
        [normalizedUserId]
      );

      return {
        sources: sourcesResult.rows,
        balances: balancesResult.rows,
        positions: positionsResult.rows,
        manualAssets: manualAssetsResult.rows,
        snapshots: snapshotsResult.rows,
      };
    }
  );

  const totalValueUsd =
    balances.reduce((sum, item) => sum + countedBalanceValue(item), 0) +
    positions.reduce((sum, item) => sum + Number(item.netValueUsd ?? 0), 0) +
    manualAssets.reduce((sum, item) => sum + Number(item.valueUsd ?? 0), 0);
  const previousTotal = Number(snapshots[1]?.totalValueUsd ?? snapshots[0]?.totalValueUsd ?? totalValueUsd);
  const changeUsd = totalValueUsd - previousTotal;
  const changePercent = previousTotal > 0 ? (changeUsd / previousTotal) * 100 : 0;
  const lastSyncedAt = sources
    .map((item) => item.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const sourceTypeTotals = { CEX: 0, ONCHAIN: 0, MANUAL: 0 } as Record<
    "CEX" | "ONCHAIN" | "MANUAL",
    number
  >;
  const categoryTotals = new Map<string, number>();

  for (const item of balances) {
    if (!isCountedBalance(item)) {
      continue;
    }

    if (item.sourceType) {
      sourceTypeTotals[item.sourceType] += Number(item.valueUsd ?? 0);
    }
    categoryTotals.set(
      item.category,
      Number(categoryTotals.get(item.category) ?? 0) + Number(item.valueUsd ?? 0)
    );
  }

  for (const item of positions) {
    if (item.sourceType) {
      sourceTypeTotals[item.sourceType] += Number(item.netValueUsd ?? 0);
    }
    categoryTotals.set(
      item.positionType,
      Number(categoryTotals.get(item.positionType) ?? 0) + Number(item.netValueUsd ?? 0)
    );
  }

  for (const item of manualAssets) {
    sourceTypeTotals.MANUAL += Number(item.valueUsd ?? 0);
    categoryTotals.set(
      item.type,
      Number(categoryTotals.get(item.type) ?? 0) + Number(item.valueUsd ?? 0)
    );
  }

  return {
    summary: {
      totalValueUsd,
      changeUsd,
      changePercent,
      sourceCount: sources.length,
      manualAssetCount: manualAssets.length,
      failedSourceCount: sources.filter((item) => item.status === "FAILED").length,
      lastSyncedAt,
      snapshotDate: snapshots[0]?.snapshotDate ?? null,
    },
    sourceTypeBreakdown: buildSourceTypeBreakdown(sourceTypeTotals, totalValueUsd),
    categoryBreakdown: buildCategoryBreakdown(
      Array.from(categoryTotals.entries()).map(([category, valueUsd]) => ({
        category,
        valueUsd,
      })),
      totalValueUsd
    ),
    topAssets: summarizeTopAssets(balances, positions, manualAssets),
    healthSummary: {
      hasIssues: sources.some((item) => item.status === "FAILED"),
      issueCount: sources.filter((item) => item.status === "FAILED").length,
    },
    meta: {
      generatedAt: now(),
    },
  };
}

export async function listAssetSources(
  userId: number,
  options: {
    status?: string | null;
    type?: string | null;
    limit?: string | null;
    offset?: string | null;
    sort?: string | null;
  } = {}
) {
  const normalizedUserId = normalizeUserId(userId);
  const values: Array<string | number> = [normalizedUserId];
  const clauses = [`asset_sources.user_id = $1`];

  if (options.status) {
    values.push(options.status.toUpperCase());
    clauses.push(`asset_sources.status = $${values.length}`);
  }

  if (options.type) {
    values.push(options.type.toUpperCase());
    clauses.push(`asset_sources.type = $${values.length}`);
  }

  values.push(toPositiveInteger(options.limit, DEFAULT_LIMIT));
  const limitIndex = values.length;
  values.push(toOffset(options.offset));
  const offsetIndex = values.length;

  return query<AssetSourceRecord & { balanceCount: string; positionCount: string; totalValueUsd: string }>(
    `
      select
        ${SOURCE_FIELDS},
        (
          select count(*)::text
          from asset_balances
          where asset_balances.source_id = asset_sources.id
        ) as "balanceCount",
        (
          select count(*)::text
          from asset_positions
          where asset_positions.source_id = asset_sources.id
        ) as "positionCount",
        (
          coalesce((select sum(value_usd) from asset_balances where asset_balances.source_id = asset_sources.id and asset_balances.category <> 'DETAIL'), 0) +
          coalesce((select sum(net_value_usd) from asset_positions where asset_positions.source_id = asset_sources.id), 0)
        )::text as "totalValueUsd"
      from asset_sources
      where ${clauses.join(" and ")}
      order by ${getSourceSort(options.sort)}
      limit $${limitIndex} offset $${offsetIndex}
    `,
    values
  ).then((rows) =>
    rows.map((row) => ({
      ...row,
      balanceCount: Number(row.balanceCount ?? 0),
      positionCount: Number(row.positionCount ?? 0),
      totalValueUsd: Number(row.totalValueUsd ?? 0),
    }))
  );
}

export async function getAssetSource(userId: number, sourceId: number) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedSourceId = Number(sourceId);
  assert(Number.isInteger(normalizedSourceId) && normalizedSourceId > 0, "Source not found.", 404);

  const source = await queryOne<
    AssetSourceRecord & { balanceCount: string; positionCount: string; totalValueUsd: string }
  >(
    `
      select
        ${SOURCE_FIELDS},
        (
          select count(*)::text
          from asset_balances
          where asset_balances.source_id = asset_sources.id
        ) as "balanceCount",
        (
          select count(*)::text
          from asset_positions
          where asset_positions.source_id = asset_sources.id
        ) as "positionCount",
        (
          coalesce((select sum(value_usd) from asset_balances where asset_balances.source_id = asset_sources.id and asset_balances.category <> 'DETAIL'), 0) +
          coalesce((select sum(net_value_usd) from asset_positions where asset_positions.source_id = asset_sources.id), 0)
        )::text as "totalValueUsd"
      from asset_sources
      where asset_sources.user_id = $1 and asset_sources.id = $2
      limit 1
    `,
    [normalizedUserId, normalizedSourceId]
  );

  assert(source, "Source not found.", 404);

  return {
    ...source,
    balanceCount: Number(source.balanceCount ?? 0),
    positionCount: Number(source.positionCount ?? 0),
    totalValueUsd: Number(source.totalValueUsd ?? 0),
  };
}

function validateSourceInput(input: Record<string, unknown>) {
  const type = normalizeText(input.type).toUpperCase();
  const provider = normalizeText(input.provider).toUpperCase();
  const name = normalizeText(input.name, provider);

  assert(type === "CEX" || type === "ONCHAIN", "Source type is invalid.");
  assert(provider, "Provider is required.");

  if (type === "CEX") {
    const apiKey = normalizeText(input.apiKey);
    const apiSecret = normalizeText(input.apiSecret);
    assert(apiKey, "API Key is required.");
    assert(apiSecret, "API Secret is required.");

    return {
      type,
      provider,
      name,
      publicRef: null,
      encryptedConfig: encryptAssetConfig({
        apiKey,
        apiSecret,
        passphrase: normalizeOptionalText(input.passphrase),
        apiKeyVersion: normalizeOptionalText(input.apiKeyVersion) ?? "3",
      }),
    };
  }

  const publicRef = normalizeText(input.publicRef || input.address);
  assert(publicRef, "Wallet address is required.");

  return {
    type,
    provider,
    name,
    publicRef,
    encryptedConfig: null,
  };
}

export async function createAssetSource(userId: number, input: Record<string, unknown>) {
  const normalizedUserId = normalizeUserId(userId);
  const totalSources = await countActiveSources(normalizedUserId);
  assert(totalSources < MAX_SOURCES_PER_USER, "Source limit reached.", 400);

  const payload = validateSourceInput(input);
  const createdAt = now();
  const source = await queryOne<AssetSourceRecord>(
    `
      insert into asset_sources (
        user_id, type, provider, name, public_ref, encrypted_config, status,
        created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $7)
      returning ${SOURCE_FIELDS}
    `,
    [
      normalizedUserId,
      payload.type,
      payload.provider,
      payload.name,
      payload.publicRef,
      payload.encryptedConfig,
      createdAt,
    ]
  );

  assert(source, "Failed to create source.", 500);

  const syncResult = await syncAssetSource(normalizedUserId, source.id);

  return {
    source: await getAssetSource(normalizedUserId, source.id),
    summary: await getAssetSummary(normalizedUserId),
    error: syncResult.error,
  };
}

export async function updateAssetSource(
  userId: number,
  sourceId: number,
  input: Record<string, unknown>
) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedSourceId = Number(sourceId);
  const source = await findSyncSource(normalizedUserId, normalizedSourceId);
  assert(source, "Source not found.", 404);

  const name = normalizeText(input.name, source.name);
  const status = normalizeText(input.status, source.status).toUpperCase();
  assert(name, "Source name is required.");
  assert(
    ["PENDING", "ACTIVE", "FAILED", "DISABLED"].includes(status),
    "Source status is invalid."
  );

  let encryptedConfig = source.encryptedConfig;
  let publicRef = source.publicRef;

  if (source.type === "CEX") {
    const apiKey = normalizeText(input.apiKey);
    const apiSecret = normalizeText(input.apiSecret);
    const passphrase = normalizeText(input.passphrase);

    if (apiKey || apiSecret || passphrase) {
      assert(apiKey && apiSecret && passphrase, "API Key, Secret, and Passphrase are required together.");
      encryptedConfig = encryptAssetConfig({
        apiKey,
        apiSecret,
        passphrase,
        apiKeyVersion: normalizeOptionalText(input.apiKeyVersion) ?? "3",
      });
    }
  }

  if (source.type === "ONCHAIN" && (input.publicRef || input.address)) {
    publicRef = normalizeText(input.publicRef || input.address);
    assert(publicRef, "Wallet address is required.");
  }

  const updated = await queryOne<AssetSourceRecord>(
    `
      update asset_sources
      set name = $3, status = $4, public_ref = $5, encrypted_config = $6, updated_at = $7
      where user_id = $1 and id = $2
      returning ${SOURCE_FIELDS}
    `,
    [normalizedUserId, normalizedSourceId, name, status, publicRef, encryptedConfig, now()]
  );

  return {
    source: updated,
    summary: await getAssetSummary(normalizedUserId),
  };
}

export async function deleteAssetSource(userId: number, sourceId: number) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedSourceId = Number(sourceId);
  const source = await findSource(normalizedUserId, normalizedSourceId);
  assert(source, "Source not found.", 404);

  await withTransaction(
    async (client) => {
      await client.query(`delete from asset_balances where user_id = $1 and source_id = $2`, [
        normalizedUserId,
        normalizedSourceId,
      ]);
      await client.query(`delete from asset_positions where user_id = $1 and source_id = $2`, [
        normalizedUserId,
        normalizedSourceId,
      ]);
      await client.query(`delete from asset_sync_logs where user_id = $1 and source_id = $2`, [
        normalizedUserId,
        normalizedSourceId,
      ]);

      const result = await client.query(
        `delete from asset_sources where user_id = $1 and id = $2`,
        [normalizedUserId, normalizedSourceId]
      );

      assert((result.rowCount ?? 0) > 0, "Source was not deleted.", 500);
    },
    { retryTransient: true }
  );
  await captureAssetSnapshot(normalizedUserId);

  return {
    deletedSourceId: normalizedSourceId,
    summary: await getAssetSummary(normalizedUserId),
  };
}

export async function listAssetBalances(
  userId: number,
  options: {
    limit?: string | null;
    offset?: string | null;
    sourceId?: string | null;
    sourceType?: string | null;
    category?: string | null;
    q?: string | null;
    sort?: string | null;
  } = {}
) {
  const normalizedUserId = normalizeUserId(userId);
  const values: Array<string | number> = [normalizedUserId];
  const clauses = [`asset_balances.user_id = $1`];

  if (options.sourceId) {
    values.push(Number(options.sourceId));
    clauses.push(`asset_balances.source_id = $${values.length}`);
  }

  if (options.sourceType) {
    values.push(options.sourceType.toUpperCase());
    clauses.push(`asset_sources.type = $${values.length}`);
  }

  if (options.category) {
    values.push(options.category.toUpperCase());
    clauses.push(`asset_balances.category = $${values.length}`);
  }

  if (options.q) {
    values.push(`%${options.q.toLowerCase()}%`);
    clauses.push(
      `(lower(asset_symbol) like $${values.length} or lower(coalesce(asset_name, '')) like $${values.length})`
    );
  }

  values.push(toPositiveInteger(options.limit, DEFAULT_LIMIT));
  const limitIndex = values.length;
  values.push(toOffset(options.offset));
  const offsetIndex = values.length;

  return query<AssetBalanceRecord>(
    `
      select ${BALANCE_FIELDS}
      from asset_balances
      join asset_sources on asset_sources.id = asset_balances.source_id
      where ${clauses.join(" and ")}
      order by ${getBalanceSort(options.sort)}
      limit $${limitIndex} offset $${offsetIndex}
    `,
    values
  );
}

export async function listAssetPositions(
  userId: number,
  options: {
    limit?: string | null;
    offset?: string | null;
    sourceId?: string | null;
    chain?: string | null;
    protocol?: string | null;
    positionType?: string | null;
    sort?: string | null;
  } = {}
) {
  const normalizedUserId = normalizeUserId(userId);
  const values: Array<string | number> = [normalizedUserId];
  const clauses = [`asset_positions.user_id = $1`];

  if (options.sourceId) {
    values.push(Number(options.sourceId));
    clauses.push(`asset_positions.source_id = $${values.length}`);
  }

  if (options.chain) {
    values.push(options.chain);
    clauses.push(`asset_positions.chain = $${values.length}`);
  }

  if (options.protocol) {
    values.push(`%${options.protocol.toLowerCase()}%`);
    clauses.push(`lower(coalesce(asset_positions.protocol_name, '')) like $${values.length}`);
  }

  if (options.positionType) {
    values.push(options.positionType.toUpperCase());
    clauses.push(`asset_positions.position_type = $${values.length}`);
  }

  values.push(toPositiveInteger(options.limit, DEFAULT_LIMIT));
  const limitIndex = values.length;
  values.push(toOffset(options.offset));
  const offsetIndex = values.length;

  return query<AssetPositionRecord>(
    `
      select ${POSITION_FIELDS}
      from asset_positions
      join asset_sources on asset_sources.id = asset_positions.source_id
      where ${clauses.join(" and ")}
      order by ${getPositionSort(options.sort)}
      limit $${limitIndex} offset $${offsetIndex}
    `,
    values
  );
}

export async function listManualAssets(
  userId: number,
  options: {
    limit?: string | null;
    offset?: string | null;
    type?: string | null;
    q?: string | null;
  } = {}
) {
  const normalizedUserId = normalizeUserId(userId);
  const values: Array<string | number> = [normalizedUserId];
  const clauses = [`user_id = $1`, `is_deleted = false`];

  if (options.type) {
    values.push(options.type.toUpperCase());
    clauses.push(`type = $${values.length}`);
  }

  if (options.q) {
    values.push(`%${options.q.toLowerCase()}%`);
    clauses.push(`(lower(name) like $${values.length} or lower(coalesce(note, '')) like $${values.length})`);
  }

  values.push(toPositiveInteger(options.limit, DEFAULT_LIMIT));
  const limitIndex = values.length;
  values.push(toOffset(options.offset));
  const offsetIndex = values.length;

  return query<ManualAssetRecord>(
    `
      select ${MANUAL_FIELDS}
      from manual_assets
      where ${clauses.join(" and ")}
      order by updated_at desc, id desc
      limit $${limitIndex} offset $${offsetIndex}
    `,
    values
  );
}

function validateManualAssetInput(
  input: Record<string, unknown>,
  current?: ManualAssetRecord | null
) {
  const name = normalizeText(input.name, current?.name ?? "");
  const type = normalizeText(input.type, current?.type ?? "").toUpperCase();
  const amount = normalizeNumber(input.amount ?? current?.amount, {
    field: "Amount",
  });
  const valueUsd = normalizeNumber(input.valueUsd ?? current?.valueUsd, {
    field: "USD value",
  });
  const note = normalizeOptionalText(input.note ?? current?.note);

  assert(name, "Name is required.");
  assert(
    ["CASH", "STOCK", "FUND", "TOKEN", "REAL_ESTATE", "OTHER"].includes(type),
    "Manual asset type is invalid."
  );

  return {
    name,
    type,
    amount,
    valueUsd,
    note,
  };
}

export async function createManualAsset(userId: number, input: Record<string, unknown>) {
  const normalizedUserId = normalizeUserId(userId);
  const totalManualAssets = await countActiveManualAssets(normalizedUserId);
  assert(totalManualAssets < MAX_MANUAL_ASSETS_PER_USER, "Manual asset limit reached.", 400);

  const payload = validateManualAssetInput(input);
  const createdAt = now();
  const asset = await queryOne<ManualAssetRecord>(
    `
      insert into manual_assets (
        user_id, name, type, amount, value_usd, note, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $7)
      returning ${MANUAL_FIELDS}
    `,
    [
      normalizedUserId,
      payload.name,
      payload.type,
      payload.amount,
      payload.valueUsd,
      payload.note,
      createdAt,
    ]
  );

  await captureAssetSnapshot(normalizedUserId);

  return {
    asset,
    summary: await getAssetSummary(normalizedUserId),
  };
}

export async function updateManualAsset(
  userId: number,
  assetId: number,
  input: Record<string, unknown>
) {
  const normalizedUserId = normalizeUserId(userId);
  const current = await queryOne<ManualAssetRecord>(
    `
      select ${MANUAL_FIELDS}
      from manual_assets
      where user_id = $1 and id = $2 and is_deleted = false
      limit 1
    `,
    [normalizedUserId, Number(assetId)]
  );

  assert(current, "Manual asset not found.", 404);
  const payload = validateManualAssetInput(input, current);
  const asset = await queryOne<ManualAssetRecord>(
    `
      update manual_assets
      set name = $3, type = $4, amount = $5, value_usd = $6, note = $7, updated_at = $8
      where user_id = $1 and id = $2
      returning ${MANUAL_FIELDS}
    `,
    [
      normalizedUserId,
      Number(assetId),
      payload.name,
      payload.type,
      payload.amount,
      payload.valueUsd,
      payload.note,
      now(),
    ]
  );

  await captureAssetSnapshot(normalizedUserId);

  return {
    asset,
    summary: await getAssetSummary(normalizedUserId),
  };
}

export async function deleteManualAsset(userId: number, assetId: number) {
  const normalizedUserId = normalizeUserId(userId);
  const asset = await queryOne<{ id: number }>(
    `
      select id
      from manual_assets
      where user_id = $1 and id = $2 and is_deleted = false
      limit 1
    `,
    [normalizedUserId, Number(assetId)]
  );

  assert(asset, "Manual asset not found.", 404);

  await execute(
    `
      update manual_assets
      set is_deleted = true, deleted_at = $3, updated_at = $3
      where user_id = $1 and id = $2
    `,
    [normalizedUserId, Number(assetId), now()]
  );
  await captureAssetSnapshot(normalizedUserId);

  return {
    summary: await getAssetSummary(normalizedUserId),
  };
}

function toSyncErrorSummary(error: unknown) {
  if (error instanceof AssetProviderError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message.slice(0, 240);
  }

  return "Asset sync failed.";
}

export async function syncAssetSource(userId: number, sourceId: number) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedSourceId = Number(sourceId);
  const source = await findSyncSource(normalizedUserId, normalizedSourceId);
  assert(source, "Source not found.", 404);

  const startedAt = new Date();
  let balances: NormalizedAssetBalance[] = [];
  let positions: NormalizedAssetPosition[] = [];
  let errorMessage: string | null = null;
  let status = "SUCCESS";

  try {
    if (source.type === "CEX") {
      const adapter = getCexAdapter(source.provider);
      if (!adapter) {
        throw new AssetProviderError(
          `${source.provider} CEX sync is not implemented yet.`,
          "UNKNOWN"
        );
      }

      const config = decryptAssetConfig(source.encryptedConfig);
      assert(config, "Source configuration is missing.", 400);

      balances = await adapter.getBalances(config);
      positions = adapter.getPositions ? await adapter.getPositions(config) : [];
    } else {
      const adapter = getOnchainAdapter(source.provider);
      if (!adapter) {
        throw new AssetProviderError(
          `${source.provider} on-chain sync is not implemented yet.`,
          "UNKNOWN"
        );
      }

      assert(source.publicRef, "Wallet address is missing.", 400);

      const config = {
        address: source.publicRef,
        provider: source.provider,
      };

      balances = await adapter.getBalances(config);
      positions = await adapter.getPositions(config);
    }
  } catch (error) {
    status = "FAILED";
    errorMessage = toSyncErrorSummary(error);
  }

  const finishedAt = new Date();
  const finishedAtIso = finishedAt.toISOString();

  await withTransaction(async (client) => {
    if (status === "SUCCESS") {
      await replaceSourceBalances(client, normalizedUserId, normalizedSourceId, balances, finishedAtIso);
      await replaceSourcePositions(client, normalizedUserId, normalizedSourceId, positions, finishedAtIso);
    }

    await client.query(
      `
        update asset_sources
        set status = $3, last_error = $4, last_synced_at = $5, updated_at = $5
        where user_id = $1 and id = $2
      `,
      [normalizedUserId, normalizedSourceId, status === "SUCCESS" ? "ACTIVE" : "FAILED", errorMessage, finishedAtIso]
    );

    await client.query(
      `
        insert into asset_sync_logs (
          user_id, source_id, status, balance_count, duration_ms, error_message,
          started_at, finished_at, created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      `,
      [
        normalizedUserId,
        normalizedSourceId,
        status,
        balances.length,
        finishedAt.getTime() - startedAt.getTime(),
        errorMessage,
        startedAt.toISOString(),
        finishedAtIso,
      ]
    );
  });

  await captureAssetSnapshot(normalizedUserId);

  return {
    source: await getAssetSource(normalizedUserId, normalizedSourceId),
    summary: await getAssetSummary(normalizedUserId),
    error: errorMessage,
  };
}

export async function syncAllAssetSources(userId: number) {
  const normalizedUserId = normalizeUserId(userId);
  const sources = await query<AssetSourceRecord>(
    `
      select ${SOURCE_FIELDS}
      from asset_sources
      where user_id = $1 and status in ('ACTIVE', 'FAILED', 'PENDING')
      order by id asc
    `,
    [normalizedUserId]
  );

  const results = [];
  for (const source of sources) {
    results.push(await syncAssetSource(normalizedUserId, source.id));
  }

  return {
    results,
    summary: await getAssetSummary(normalizedUserId),
  };
}

export async function getAssetHealth(
  userId: number,
  options: { limit?: string | null; sourceId?: string | null; status?: string | null } = {}
) {
  const normalizedUserId = normalizeUserId(userId);
  const values: Array<string | number> = [normalizedUserId];
  const clauses = [`asset_sync_logs.user_id = $1`];

  if (options.sourceId) {
    values.push(Number(options.sourceId));
    clauses.push(`asset_sync_logs.source_id = $${values.length}`);
  }

  if (options.status) {
    values.push(options.status.toUpperCase());
    clauses.push(`asset_sync_logs.status = $${values.length}`);
  }

  const failedSources = await query<AssetSourceRecord>(
    `
      select ${SOURCE_FIELDS}
      from asset_sources
      where user_id = $1 and status = 'FAILED'
      order by updated_at desc, id desc
      limit 10
    `,
    [normalizedUserId]
  );

  values.push(toPositiveInteger(options.limit, 10));
  const limitIndex = values.length;

  const logs = await query<AssetSyncLogRecord>(
    `
      select ${SYNC_LOG_FIELDS}
      from asset_sync_logs
      left join asset_sources on asset_sources.id = asset_sync_logs.source_id
      where ${clauses.join(" and ")}
      order by asset_sync_logs.created_at desc, asset_sync_logs.id desc
      limit $${limitIndex}
    `,
    values
  );

  return {
    summary: {
      hasIssues: failedSources.length > 0,
      issueCount: failedSources.length,
      failedSourceCount: failedSources.length,
    },
    failedSources,
    syncLogs: logs,
  };
}

export async function captureAssetsForAllUsers(runAt = new Date()) {
  const sources = await query<{ userId: number; sourceId: number }>(
    `
      select user_id as "userId", id as "sourceId"
      from asset_sources
      where status in ('ACTIVE', 'FAILED', 'PENDING')
      order by user_id asc, id asc
    `
  );

  let processedCount = 0;
  const touchedUsers = new Set<number>();

  for (const source of sources) {
    processedCount += 1;
    touchedUsers.add(source.userId);
    await syncAssetSource(source.userId, source.sourceId);
  }

  for (const userId of touchedUsers) {
    await captureAssetSnapshot(userId, runAt);
  }

  return {
    processedCount,
    userCount: touchedUsers.size,
  };
}
