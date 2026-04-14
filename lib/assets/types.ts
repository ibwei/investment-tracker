export type AssetSourceType = "CEX" | "ONCHAIN";

export type AssetSourceStatus = "PENDING" | "ACTIVE" | "FAILED" | "DISABLED";

export type ManualAssetType =
  | "CASH"
  | "STOCK"
  | "FUND"
  | "TOKEN"
  | "REAL_ESTATE"
  | "OTHER";

export type AssetBalanceCategory = "SPOT" | "EARN" | "DEFI" | "CASH" | "DETAIL" | "OTHER";

export type AssetPositionType =
  | "LP"
  | "LENDING"
  | "BORROWING"
  | "STAKING"
  | "FARMING"
  | "VESTING"
  | "DEFI"
  | "OTHER";

export interface AssetSummaryResponse {
  summary: {
    totalValueUsd: number;
    changeUsd: number;
    changePercent: number;
    sourceCount: number;
    manualAssetCount: number;
    failedSourceCount: number;
    lastSyncedAt?: string | null;
    snapshotDate?: string | null;
  };
  sourceTypeBreakdown: Array<{
    type: "CEX" | "ONCHAIN" | "MANUAL";
    valueUsd: number;
    percentage: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    valueUsd: number;
    percentage: number;
  }>;
  topAssets: Array<{
    label: string;
    category: string;
    sourceType: "CEX" | "ONCHAIN" | "MANUAL";
    sourceId?: number | null;
    sourceName?: string;
    categories?: string[];
    sourceTypes?: Array<"CEX" | "ONCHAIN" | "MANUAL">;
    valueUsd: number;
    balanceCount?: number;
    positionCount?: number;
    manualAssetCount?: number;
  }>;
  healthSummary: {
    hasIssues: boolean;
    issueCount: number;
  };
  meta: {
    displayCurrency?: string;
    generatedAt: string;
  };
}

export interface AssetSourceRecord {
  id: number;
  userId?: number;
  type: AssetSourceType;
  provider: string;
  name: string;
  publicRef: string | null;
  status: AssetSourceStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  balanceCount?: number;
  positionCount?: number;
  totalValueUsd?: number;
}

export interface AssetBalanceRecord {
  id: number;
  userId?: number;
  sourceId: number;
  sourceName?: string;
  sourceType?: AssetSourceType;
  assetSymbol: string;
  assetName: string | null;
  amount: number;
  valueUsd: number;
  category: string;
  updatedAt: string;
}

export interface AssetPositionRecord {
  id: number;
  userId?: number;
  sourceId: number;
  sourceName?: string;
  sourceType?: AssetSourceType;
  provider: string;
  chain: string | null;
  protocolId: string | null;
  protocolName: string | null;
  positionType: string;
  assetValueUsd: number;
  debtValueUsd: number;
  rewardValueUsd: number;
  netValueUsd: number;
  updatedAt: string;
}

export interface ManualAssetRecord {
  id: number;
  userId?: number;
  name: string;
  type: ManualAssetType;
  amount: number;
  valueUsd: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSnapshotRecord {
  snapshotDate: string;
  totalValueUsd: number;
  breakdown?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AssetSyncLogRecord {
  id: number;
  userId: number | null;
  sourceId: number | null;
  sourceName?: string | null;
  status: string;
  balanceCount: number;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export type NormalizedAssetBalance = {
  assetSymbol: string;
  assetName?: string;
  amount: number;
  valueUsd: number;
  category: AssetBalanceCategory;
  rawData?: unknown;
};

export type NormalizedAssetPosition = {
  provider: string;
  chain?: string;
  protocolId?: string;
  protocolName?: string;
  positionType: AssetPositionType;
  assetValueUsd: number;
  debtValueUsd: number;
  rewardValueUsd: number;
  netValueUsd: number;
  rawData?: unknown;
};
