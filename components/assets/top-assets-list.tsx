"use client";

import { useState } from "react";
import { ChevronDown, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  AssetBalanceRecord,
  AssetPositionRecord,
  AssetSummaryResponse,
} from "@/lib/assets/types";
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
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload as T;
}

function getSourceKey(source: SourceSummary) {
  return `${source.sourceType}:${source.sourceId ?? source.sourceName ?? source.label}`;
}

function getDistributionSummary(source: SourceSummary) {
  const parts = [];
  const balanceCount = source.balanceCount ?? 0;
  const positionCount = source.positionCount ?? 0;
  const manualAssetCount = source.manualAssetCount ?? 0;

  if (balanceCount > 0) {
    parts.push(`${balanceCount} tokens`);
  }
  if (positionCount > 0) {
    parts.push(`${positionCount} positions`);
  }
  if (manualAssetCount > 0) {
    parts.push(`${manualAssetCount} manual assets`);
  }

  return parts.join(" / ") || source.category;
}

export function TopAssetsList({
  assets,
  isAuthenticated,
  formatDisplayCurrency,
}: TopAssetsListProps) {
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [sourceDetails, setSourceDetails] = useState<Record<string, LoadedSourceDetail>>({});
  const [loadingSource, setLoadingSource] = useState<string | null>(null);

  async function loadSourceDetail(source: SourceSummary, force = false) {
    const sourceKey = getSourceKey(source);

    if (!force && expandedSource === sourceKey) {
      setExpandedSource(null);
      return;
    }

    setExpandedSource(sourceKey);

    if (!force && sourceDetails[sourceKey]) {
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

    setLoadingSource(sourceKey);

    try {
      await requestJson(`/api/assets/sources/${source.sourceId}/sync`, {
        method: "POST",
      });
      const [balancePayload, positionPayload] = await Promise.all([
        requestJson<{ balances: AssetBalanceRecord[] }>(
          `/api/assets/balances?sourceId=${source.sourceId}&limit=50&offset=0&sort=valueUsd.desc`
        ),
        requestJson<{ positions: AssetPositionRecord[] }>(
          `/api/assets/positions?sourceId=${source.sourceId}&limit=50&offset=0&sort=netValueUsd.desc`
        ),
      ]);

      setSourceDetails((current) => ({
        ...current,
        [sourceKey]: {
          balances: balancePayload.balances,
          positions: positionPayload.positions,
          syncedAt: new Date().toISOString(),
        },
      }));
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load source detail.");
    } finally {
      setLoadingSource(null);
    }
  }

  if (assets.length === 0) {
    return <div className="text-sm text-muted-foreground">No sources yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background/40">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/60 px-4 py-2 text-xs font-medium uppercase tracking-normal text-muted-foreground sm:grid-cols-[minmax(140px,1fr)_minmax(220px,1.4fr)_auto]">
        <span>Source</span>
        <span className="hidden sm:block">Distribution</span>
        <span className="text-right">Value</span>
      </div>
      <div className="divide-y divide-border/60">
        {assets.map((source) => {
          const sourceKey = getSourceKey(source);
          const isExpanded = expandedSource === sourceKey;
          const detail = sourceDetails[sourceKey];
          const isLoading = loadingSource === sourceKey;

          return (
            <div key={sourceKey}>
              <button
                type="button"
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(140px,1fr)_minmax(220px,1.4fr)_auto]"
                onClick={() => void loadSourceDetail(source)}
                aria-expanded={isExpanded}
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
                    {getDistributionSummary(source)}
                  </span>
                </span>
                <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
                  {getDistributionSummary(source)}
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
                          ? `Updated ${new Date(detail.syncedAt).toLocaleString()}`
                          : source.sourceType === "MANUAL"
                            ? "Manual assets are managed separately."
                            : "Opening this source syncs and loads its token distribution."}
                      </span>
                      {source.sourceId && source.sourceType !== "MANUAL" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={isLoading}
                          onClick={() => {
                            setSourceDetails((current) => {
                              const next = { ...current };
                              delete next[sourceKey];
                              return next;
                            });
                            void loadSourceDetail(source, true);
                          }}
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </Button>
                      ) : null}
                    </div>

                    {detail?.balances.length ? (
                      <div className="space-y-2">
                        {detail.balances.map((balance) => (
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

                    {detail?.positions.length ? (
                      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                        {detail.positions.map((position) => (
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

                    {detail && detail.balances.length === 0 && detail.positions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {source.sourceType === "MANUAL"
                          ? "Open the Manual tab to edit these assets."
                          : "No balance or position data for this source."}
                      </div>
                    ) : null}

                    {!detail && isLoading ? (
                      <div className="text-sm text-muted-foreground">Loading source detail...</div>
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
