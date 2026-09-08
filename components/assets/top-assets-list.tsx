"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader2, RefreshCcw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { readResource } from "@/lib/client-request";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  AssetBalanceRecord,
  AssetPositionRecord,
  AssetSummaryResponse,
} from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SourceSummary = AssetSummaryResponse["topAssets"][number];

type LoadedSourceDetail = {
  balances: AssetBalanceRecord[];
  positions: AssetPositionRecord[];
  syncedAt: string;
};

type TopAssetsListProps = {
  assets: SourceSummary[];
  isAuthenticated: boolean;
  formatDisplayCurrency: (value: number) => string;
  onSyncSource: (id: number) => Promise<boolean>;
  refreshVersion: number;
  isActionPending: boolean;
};

const MIN_VISIBLE_BALANCE_USD = 0.1;

function getSourceKey(source: SourceSummary) {
  return `${source.sourceType}:${source.sourceId ?? source.sourceName ?? source.label}`;
}

function getDistributionSummary(source: SourceSummary, t: (key: string, vars?: Record<string, any>) => string) {
  const parts = [];
  const balanceCount = source.balanceCount ?? 0;
  const positionCount = source.positionCount ?? 0;
  const manualAssetCount = source.manualAssetCount ?? 0;

  if (balanceCount > 0) {
    parts.push(t("assets.topAssets.tokens", { count: balanceCount }));
  }
  if (positionCount > 0) {
    parts.push(t("assets.topAssets.positions", { count: positionCount }));
  }
  if (manualAssetCount > 0) {
    parts.push(t("assets.topAssets.manualAssets", { count: manualAssetCount }));
  }

  return parts.join(" / ") || t("assets.topAssets.distributionFallback", { value: source.category });
}

export function TopAssetsList({
  assets,
  isAuthenticated,
  formatDisplayCurrency,
  onSyncSource,
  refreshVersion,
  isActionPending,
}: TopAssetsListProps) {
  const { user } = useAuth();
  const scope = user?.id ? `user:${user.id}` : 'guest';
  const alive = useRef(true);
  const versions = useRef<Record<string, number>>({});
  const { formatDate, t } = useI18n();
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [sourceDetails, setSourceDetails] = useState<Record<string, LoadedSourceDetail>>({});
  const [loadingSources, setLoadingSources] = useState<Record<string, boolean>>({});
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const source = assets.find(item => getSourceKey(item) === expandedSource);
    if (source) void loadSourceDetail(source, true);
  }, [refreshVersion]);

  async function loadSourceDetail(source: SourceSummary, force = false) {
    const sourceKey = getSourceKey(source);

    if (loadingSources[sourceKey] && !force) {
      return;
    }

    if (!force && expandedSource === sourceKey) {
      setExpandedSource(null);
      return;
    }

    setExpandedSource(sourceKey);

    if (!force && sourceDetails[sourceKey] && Date.now() - Date.parse(sourceDetails[sourceKey].syncedAt) < 30_000) {
      return;
    }

    if (!source.sourceId || source.sourceType === "MANUAL") {
      setSourceDetails((current) => ({
        ...current,
        [sourceKey]: {
          balances: [],
          positions: [],
          syncedAt: new Date().toISOString(),
        },
      }));
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    const version = versions.current[sourceKey] = (versions.current[sourceKey] ?? 0) + 1;
    setLoadingSources(current => ({ ...current, [sourceKey]: true }));

    try {
      const [balancePayload, positionPayload] = await Promise.all([
        readResource<{ balances: AssetBalanceRecord[] }>(scope,
          `/api/assets/balances?sourceId=${source.sourceId}&limit=50&offset=0&sort=valueUsd.desc`, force
        ),
        readResource<{ positions: AssetPositionRecord[] }>(scope,
          `/api/assets/positions?sourceId=${source.sourceId}&limit=50&offset=0&sort=netValueUsd.desc`, force
        ),
      ]);

      if (!alive.current || version !== versions.current[sourceKey]) return;
      setSourceDetails((current) => ({
        ...current,
        [sourceKey]: {
          balances: balancePayload.balances,
          positions: positionPayload.positions,
          syncedAt: new Date().toISOString(),
        },
      }));
    } catch (error: any) {
      if (alive.current && version === versions.current[sourceKey]) toast.error(t("request.refreshFailed"));
    } finally {
      if (alive.current && version === versions.current[sourceKey]) setLoadingSources(current => ({ ...current, [sourceKey]: false }));
    }
  }

  async function refreshSourceDetail(source: SourceSummary) {
    if (!source.sourceId || source.sourceType === 'MANUAL' || isActionPending) return;
    await onSyncSource(source.sourceId);
  }

  if (assets.length === 0) {
    return <div className="text-sm text-muted-foreground">{t("assets.topAssets.empty")}</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background/40">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/60 px-4 py-2 text-xs font-medium uppercase tracking-normal text-muted-foreground sm:grid-cols-[minmax(140px,1fr)_minmax(220px,1.4fr)_auto]">
        <span>{t("assets.topAssets.headerSource")}</span>
        <span className="hidden sm:block">{t("assets.topAssets.headerDistribution")}</span>
        <span className="text-right">{t("assets.topAssets.headerValue")}</span>
      </div>
      <div className="divide-y divide-border/60">
        {assets.map((source) => {
          const sourceKey = getSourceKey(source);
          const isExpanded = expandedSource === sourceKey;
          const detail = sourceDetails[sourceKey];
          const visibleBalances =
            detail?.balances.filter((balance) => Number(balance.valueUsd ?? 0) >= MIN_VISIBLE_BALANCE_USD) ?? [];
          const visiblePositions =
            detail?.positions.filter((position) => Number(position.netValueUsd ?? 0) >= MIN_VISIBLE_BALANCE_USD) ?? [];
          const isLoading = loadingSources[sourceKey];

          return (
            <div key={sourceKey}>
              <button
                type="button"
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(140px,1fr)_minmax(220px,1.4fr)_auto]"
                onClick={() => void loadSourceDetail(source)}
                aria-expanded={isExpanded}
                disabled={isLoading || isActionPending}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded ? "rotate-0" : "-rotate-90"
                      )}
                    />
                    <span className="truncate font-medium">{source.sourceName ?? source.label}</span>
                    <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-xs text-muted-foreground">
                      {source.sourceType}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground sm:hidden">
                    {getDistributionSummary(source, t)}
                  </span>
                </span>
                <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
                  {getDistributionSummary(source, t)}
                </span>
                <span className="flex justify-end gap-2 text-right font-medium">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {formatDisplayCurrency(source.valueUsd)}
                </span>
              </button>

              {isExpanded ? (
                <div className="bg-muted/20 px-4 pb-4 pt-1">
                  <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>
                        {detail
                          ? t("assets.topAssets.updatedAt", {
                              time: formatDate(detail.syncedAt),
                            })
                          : source.sourceType === "MANUAL"
                            ? t("assets.topAssets.manualHint")
                            : t("assets.topAssets.openHint")}
                      </span>
                      {source.sourceId && source.sourceType !== "MANUAL" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={isLoading}
                          disabled={isLoading || isActionPending}
                          onClick={() => {
                            void refreshSourceDetail(source);
                          }}
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {t("assets.topAssets.refresh")}
                        </Button>
                      ) : null}
                    </div>

                    {visibleBalances.length ? (
                      <div className="space-y-2">
                        {visibleBalances.map((balance) => (
                          <div
                            key={balance.id}
                            className="grid grid-cols-[1fr_auto] gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate text-muted-foreground">
                              {balance.assetSymbol}
                              <span className="ml-2">{balance.amount}</span>
                              <span className="ml-2 text-xs">{balance.category}</span>
                            </span>
                            <span className="font-medium">
                              {formatDisplayCurrency(balance.valueUsd)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {visiblePositions.length ? (
                      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                        {visiblePositions.map((position) => (
                          <div
                            key={position.id}
                            className="grid grid-cols-[1fr_auto] gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate text-muted-foreground">
                              {position.protocolName || position.provider}
                              <span className="ml-2">{position.positionType}</span>
                            </span>
                            <span className="font-medium">
                              {formatDisplayCurrency(position.netValueUsd)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {detail && visibleBalances.length === 0 && visiblePositions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {source.sourceType === "MANUAL"
                          ? t("assets.topAssets.manualEditHint")
                          : t("assets.topAssets.emptyDetail")}
                      </div>
                    ) : null}

                    {!detail && isLoading ? (
                      <div className="text-sm text-muted-foreground">
                        {t("assets.topAssets.loadingDetail")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
