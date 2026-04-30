"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { AssetAllocationChart } from "@/components/assets/asset-allocation-chart";
import { AssetBalanceTable } from "@/components/assets/asset-balance-table";
import { AssetHealthPanel } from "@/components/assets/asset-health-panel";
import { AssetSourceForm } from "@/components/assets/asset-source-form";
import { AssetSourceList } from "@/components/assets/asset-source-list";
import { AssetSummaryCards } from "@/components/assets/asset-summary-cards";
import { AssetTrendChart } from "@/components/assets/asset-trend-chart";
import { ManualAssetForm } from "@/components/assets/manual-asset-form";
import { ManualAssetList } from "@/components/assets/manual-asset-list";
import { TopAssetsList } from "@/components/assets/top-assets-list";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  previewAssetBalances,
  previewAssetPositions,
  previewAssetSnapshots,
  previewAssetSources,
  previewAssetSummary,
  previewAssetSyncLogs,
  previewManualAssets,
} from "@/lib/assets/preview-data";
import type {
  AssetBalanceRecord,
  AssetPositionRecord,
  AssetSnapshotRecord,
  AssetSourceRecord,
  AssetSummaryResponse,
  AssetSyncLogRecord,
  ManualAssetRecord,
} from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

type AssetTab = "overview" | "trend" | "sources" | "manual" | "balances" | "health";

type HealthResponse = {
  failedSources: AssetSourceRecord[];
  syncLogs: AssetSyncLogRecord[];
};

type AssetMutationResponse = {
  summary?: AssetSummaryResponse;
  source?: AssetSourceRecord;
  deletedSourceId?: number;
  asset?: ManualAssetRecord;
  results?: Array<{
    source?: AssetSourceRecord;
    summary?: AssetSummaryResponse;
    error?: string | null;
  }>;
  error?: string | null;
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

export default function AssetsPage() {
  const { isAuthenticated } = useAuth();
  const { formatDisplayCurrency, t } = useI18n();
  const [activeTab, setActiveTab] = useState<AssetTab>("overview");
  const [summary, setSummary] = useState<AssetSummaryResponse | null>(null);
  const [sources, setSources] = useState<AssetSourceRecord[]>([]);
  const [manualAssets, setManualAssets] = useState<ManualAssetRecord[]>([]);
  const [balances, setBalances] = useState<AssetBalanceRecord[]>([]);
  const [positions, setPositions] = useState<AssetPositionRecord[]>([]);
  const [snapshots, setSnapshots] = useState<AssetSnapshotRecord[]>([]);
  const [health, setHealth] = useState<HealthResponse>({ failedSources: [], syncLogs: [] });
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({});
  const [trendRange, setTrendRange] = useState(30);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<AssetSourceRecord | null>(null);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [editingManualAsset, setEditingManualAsset] = useState<ManualAssetRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<number | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<number | null>(null);
  const [deletingManualAssetId, setDeletingManualAssetId] = useState<number | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const tabs = [
    { key: "overview", label: t("assets.tabs.overview") },
    { key: "trend", label: t("assets.tabs.trend") },
    { key: "sources", label: t("assets.tabs.sources") },
    { key: "manual", label: t("assets.tabs.manual") },
    { key: "balances", label: t("assets.tabs.balances") },
    { key: "health", label: t("assets.tabs.health") },
  ] as const;

  async function loadSummary() {
    if (!isAuthenticated) {
      setSummary(previewAssetSummary);
      return;
    }

    const payload = await requestJson<AssetSummaryResponse>("/api/assets/summary");
    setSummary(payload);
  }

  async function loadTabData(tab: AssetTab, force = false) {
    if (!isAuthenticated) {
      if (tab === "trend") {
        setSnapshots(previewAssetSnapshots);
      }
      if (tab === "sources") {
        setSources(previewAssetSources);
      }
      if (tab === "manual") {
        setManualAssets(previewManualAssets);
      }
      if (tab === "balances") {
        setBalances(previewAssetBalances);
        setPositions(previewAssetPositions);
      }
      if (tab === "health") {
        setHealth({
          failedSources: previewAssetSources.filter((item) => item.status === "FAILED"),
          syncLogs: previewAssetSyncLogs,
        });
      }
      setLoadedTabs((current) => ({ ...current, [tab]: true }));
      return;
    }

    if (loadedTabs[tab] && !force) {
      return;
    }

    setIsDetailLoading(true);

    try {
      if (tab === "trend") {
        const payload = await requestJson<{ snapshots: AssetSnapshotRecord[] }>(
          `/api/assets/snapshots?days=${trendRange}`
        );
        setSnapshots(payload.snapshots);
      }

      if (tab === "sources") {
        const payload = await requestJson<{ sources: AssetSourceRecord[] }>("/api/assets/sources");
        setSources(payload.sources);
      }

      if (tab === "manual") {
        const payload = await requestJson<{ assets: ManualAssetRecord[] }>("/api/assets/manual");
        setManualAssets(payload.assets);
      }

      if (tab === "balances") {
        const [balancePayload, positionPayload] = await Promise.all([
          requestJson<{ balances: AssetBalanceRecord[] }>(
            "/api/assets/balances?limit=20&offset=0&sort=valueUsd.desc"
          ),
          requestJson<{ positions: AssetPositionRecord[] }>(
            "/api/assets/positions?limit=20&offset=0&sort=netValueUsd.desc"
          ),
        ]);
        setBalances(balancePayload.balances);
        setPositions(positionPayload.positions);
      }

      if (tab === "health") {
        setHealth(await requestJson<HealthResponse>("/api/assets/health"));
      }

      setLoadedTabs((current) => ({ ...current, [tab]: true }));
    } finally {
      setIsDetailLoading(false);
    }
  }

  function applyAssetMutationResponse(response: AssetMutationResponse) {
    if (response.summary) {
      setSummary(response.summary);
    }

    if (response.source) {
      setSources((current) => {
        const existingIndex = current.findIndex((source) => source.id === response.source?.id);
        if (existingIndex === -1) {
          return [response.source as AssetSourceRecord, ...current];
        }

        return current.map((source) =>
          source.id === response.source?.id ? (response.source as AssetSourceRecord) : source
        );
      });
    }

    if (response.deletedSourceId) {
      setSources((current) => current.filter((source) => source.id !== response.deletedSourceId));
    }

    if (response.asset) {
      setManualAssets((current) => {
        const existingIndex = current.findIndex((asset) => asset.id === response.asset?.id);
        if (existingIndex === -1) {
          return [response.asset as ManualAssetRecord, ...current];
        }

        return current.map((asset) =>
          asset.id === response.asset?.id ? (response.asset as ManualAssetRecord) : asset
        );
      });
    }
  }

  async function refreshAllAssetData(fallbackSummary?: AssetSummaryResponse) {
    if (fallbackSummary) {
      setSummary(fallbackSummary);
    }

    try {
      await loadSummary();
    } catch (error) {
      if (!fallbackSummary) {
        throw error;
      }
    }

    const tabsToRefresh: AssetTab[] = ["trend", "sources", "manual", "balances", "health"];
    await Promise.all(tabsToRefresh.map((tab) => loadTabData(tab, true)));
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setIsPageLoading(true);
      try {
        await loadSummary();
        if (mounted) {
          setLoadedTabs({ overview: true });
        }
      } catch (error: any) {
        toast.error(error?.message ?? t("assets.toast.loadFailed"));
      } finally {
        if (mounted) {
          setIsPageLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === "trend" && isAuthenticated && loadedTabs.trend) {
      void loadTabData("trend", true);
    }
  }, [trendRange]);

  useEffect(() => {
    if (activeTab === "overview") {
      void loadSummary();
      return;
    }

    void loadTabData(activeTab);
  }, [activeTab, isAuthenticated]);

  const topAssets = useMemo(() => summary?.topAssets ?? [], [summary]);

  async function handleSaveSource(payload: Record<string, string>) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await requestJson<AssetMutationResponse>(
        editingSource ? `/api/assets/sources/${editingSource.id}` : "/api/assets/sources",
        {
          method: editingSource ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setSourceFormOpen(false);
      setEditingSource(null);
      applyAssetMutationResponse(response);
      await refreshAllAssetData(response.summary);
      toast.success(response.error ? t("assets.toast.saveSourceWarn") : t("assets.toast.saveSource"));
      if (response.error) {
        toast.message(response.error);
      }
    } catch (error: any) {
      toast.error(error?.message ?? t("assets.toast.saveSourceFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSyncSource(sourceId: number) {
    if (syncingSourceId !== null || deletingSourceId !== null || isSyncingAll) {
      return;
    }

    setSyncingSourceId(sourceId);
    try {
      const response = await requestJson<AssetMutationResponse>(`/api/assets/sources/${sourceId}/sync`, {
        method: "POST",
      });
      applyAssetMutationResponse(response);
      await refreshAllAssetData(response.summary);
      toast.success(response.error ? t("assets.toast.syncWarn") : t("assets.toast.syncDone"));
      if (response.error) {
        toast.message(response.error);
      }
    } catch (error: any) {
      toast.error(error?.message ?? t("assets.toast.syncFailed"));
    } finally {
      setSyncingSourceId(null);
    }
  }

  async function handleDeleteSource(sourceId: number) {
    if (deletingSourceId !== null || syncingSourceId !== null || isSyncingAll) {
      return;
    }

    setDeletingSourceId(sourceId);
    const deletedSource = sources.find((source) => source.id === sourceId) ?? null;
    setSources((current) => current.filter((source) => source.id !== sourceId));

    try {
      const response = await requestJson<AssetMutationResponse>(`/api/assets/sources/${sourceId}`, {
        method: "DELETE",
      });
      applyAssetMutationResponse(response);
      await refreshAllAssetData(response.summary);
      toast.success(t("assets.toast.deleteSource"));
    } catch (error: any) {
      if (deletedSource) {
        setSources((current) =>
          current.some((source) => source.id === deletedSource.id)
            ? current
            : [deletedSource, ...current]
        );
      }
      toast.error(error?.message ?? t("assets.toast.deleteSourceFailed"));
    } finally {
      setDeletingSourceId(null);
    }
  }

  async function handleSaveManualAsset(payload: Record<string, string | number>) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      let response: AssetMutationResponse;
      if (editingManualAsset) {
        response = await requestJson<AssetMutationResponse>(`/api/assets/manual/${editingManualAsset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await requestJson<AssetMutationResponse>("/api/assets/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setManualFormOpen(false);
      setEditingManualAsset(null);
      applyAssetMutationResponse(response);
      await refreshAllAssetData(response.summary);
      toast.success(t("assets.toast.saveManual"));
    } catch (error: any) {
      toast.error(error?.message ?? t("assets.toast.saveManualFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteManualAsset(assetId: number) {
    if (deletingManualAssetId !== null) {
      return;
    }

    setDeletingManualAssetId(assetId);
    try {
      const response = await requestJson<AssetMutationResponse>(`/api/assets/manual/${assetId}`, {
        method: "DELETE",
      });
      setManualAssets((current) => current.filter((asset) => asset.id !== assetId));
      applyAssetMutationResponse(response);
      await refreshAllAssetData(response.summary);
      toast.success(t("assets.toast.deleteManual"));
    } catch (error: any) {
      toast.error(error?.message ?? t("assets.toast.deleteManualFailed"));
    } finally {
      setDeletingManualAssetId(null);
    }
  }

  async function handleSyncAll() {
    if (isSyncingAll || syncingSourceId !== null || deletingSourceId !== null) {
      return;
    }

    setIsSyncingAll(true);
    try {
      const response = await requestJson<AssetMutationResponse>("/api/assets/sync", {
        method: "POST",
      });
      applyAssetMutationResponse(response);
      await refreshAllAssetData(response.summary);
      toast.success(
        t("assets.toast.syncAll", { count: response.results?.length ?? 0 })
      );
    } catch (error: any) {
      toast.error(error?.message ?? t("assets.toast.syncAllFailed"));
    } finally {
      setIsSyncingAll(false);
    }
  }

  const isSourceActionPending = syncingSourceId !== null || deletingSourceId !== null || isSyncingAll;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("assets.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">{t("assets.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={!isAuthenticated || isSourceActionPending}
              loading={isSyncingAll}
            >
              {isSyncingAll ? null : <RefreshCcw className="h-4 w-4" />}
              {t("assets.syncAll")}
            </Button>
            <Button
              onClick={() => setSourceFormOpen(true)}
              disabled={!isAuthenticated || isSubmitting || isSourceActionPending}
            >
              <Plus className="h-4 w-4" />
              {t("assets.addSource")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setManualFormOpen(true)}
              disabled={!isAuthenticated || isSubmitting || deletingManualAssetId !== null}
            >
              <Plus className="h-4 w-4" />
              {t("assets.addManual")}
            </Button>
          </div>
        </div>

        {!isAuthenticated ? (
          <Card className="mb-6 gap-0 border-primary/20 bg-primary/5 py-0 sm:mb-8">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("assets.previewTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("assets.previewDescription")}
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild size="sm">
                  <Link href="/register">{t("nav.getStarted")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">{t("nav.login")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {summary ? <AssetSummaryCards summary={summary.summary} /> : null}

        <div className="mt-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          {activeTab === "overview" && summary ? (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <AssetAllocationChart
                  title={t("assets.allocation.bySourceType")}
                  description={t("assets.allocation.sourceTypeDescription")}
                  items={summary.sourceTypeBreakdown}
                  labelKey="type"
                  isLoading={isPageLoading || isSyncingAll}
                />
                <AssetAllocationChart
                  title={t("assets.allocation.byCategory")}
                  description={t("assets.allocation.categoryDescription")}
                  items={summary.categoryBreakdown}
                  labelKey="category"
                  isLoading={isPageLoading || isSyncingAll}
                />
              </div>
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle>{t("assets.allocation.bySource")}</CardTitle>
                  <CardDescription>{t("assets.allocation.bySourceDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TopAssetsList
                    assets={topAssets}
                    isAuthenticated={isAuthenticated}
                    formatDisplayCurrency={formatDisplayCurrency}
                    onSummaryChange={setSummary}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}

          {activeTab === "trend" ? (
            <AssetTrendChart
              snapshots={snapshots}
              range={trendRange}
              onRangeChange={setTrendRange}
              isLoading={isDetailLoading}
            />
          ) : null}

          {activeTab === "sources" ? (
            <AssetSourceList
              sources={sources}
              onSync={handleSyncSource}
              onEdit={(source) => {
                setEditingSource(source);
                setSourceFormOpen(true);
              }}
              onDelete={handleDeleteSource}
              isAuthenticated={isAuthenticated}
              isLoading={isDetailLoading}
              syncingSourceId={syncingSourceId}
              deletingSourceId={deletingSourceId}
              isActionPending={isSourceActionPending}
            />
          ) : null}

          {activeTab === "manual" ? (
            <ManualAssetList
              assets={manualAssets}
              onEdit={(asset) => {
                setEditingManualAsset(asset);
                setManualFormOpen(true);
              }}
              onDelete={handleDeleteManualAsset}
              isAuthenticated={isAuthenticated}
              deletingAssetId={deletingManualAssetId}
              isLoading={isDetailLoading}
            />
          ) : null}

          {activeTab === "balances" ? (
            <AssetBalanceTable balances={balances} positions={positions} isLoading={isDetailLoading} />
          ) : null}

          {activeTab === "health" ? (
            <AssetHealthPanel
              failedSources={health.failedSources}
              syncLogs={health.syncLogs}
              isLoading={isDetailLoading}
            />
          ) : null}

          {isPageLoading ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
              {t("assets.loading")}
            </div>
          ) : null}
        </div>
      </main>

      <AssetSourceForm
        open={sourceFormOpen}
        onOpenChange={(open) => {
          setSourceFormOpen(open);
          if (!open) {
            setEditingSource(null);
          }
        }}
        source={editingSource}
        onSubmit={handleSaveSource}
        isSubmitting={isSubmitting}
      />
      <ManualAssetForm
        open={manualFormOpen}
        onOpenChange={(open) => {
          setManualFormOpen(open);
          if (!open) {
            setEditingManualAsset(null);
          }
        }}
        asset={editingManualAsset}
        onSubmit={handleSaveManualAsset}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
