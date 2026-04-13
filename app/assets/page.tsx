"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCcw } from "lucide-react";
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
  const { formatDisplayCurrency } = useI18n();
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

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "trend", label: "Trend" },
    { key: "sources", label: "Sources" },
    { key: "manual", label: "Manual" },
    { key: "balances", label: "Balances" },
    { key: "health", label: "Health" },
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

  async function refreshSummaryAndOpenTabs() {
    await loadSummary();

    const tabsToRefresh = Object.keys(loadedTabs).filter((key) => loadedTabs[key]) as AssetTab[];
    for (const tab of tabsToRefresh) {
      await loadTabData(tab, true);
    }
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
        toast.error(error?.message ?? "Failed to load assets.");
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
    if (activeTab !== "overview") {
      void loadTabData(activeTab);
    }
  }, [activeTab, isAuthenticated]);

  const topAssets = useMemo(() => summary?.topAssets ?? [], [summary]);

  async function handleSaveSource(payload: Record<string, string>) {
    setIsSubmitting(true);
    try {
      const response = await requestJson<{ error?: string }>(
        editingSource ? `/api/assets/sources/${editingSource.id}` : "/api/assets/sources",
        {
        method: editingSource ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        }
      );
      setSourceFormOpen(false);
      setEditingSource(null);
      await refreshSummaryAndOpenTabs();
      toast.success(response.error ? "Source saved with sync warning." : "Source saved.");
      if (response.error) {
        toast.message(response.error);
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save source.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSyncSource(sourceId: number) {
    try {
      const response = await requestJson<{ error?: string }>(`/api/assets/sources/${sourceId}/sync`, {
        method: "POST",
      });
      await refreshSummaryAndOpenTabs();
      toast.success(response.error ? "Sync finished with warning." : "Sync finished.");
      if (response.error) {
        toast.message(response.error);
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to sync source.");
    }
  }

  async function handleDeleteSource(sourceId: number) {
    try {
      await requestJson(`/api/assets/sources/${sourceId}`, { method: "DELETE" });
      await refreshSummaryAndOpenTabs();
      toast.success("Source deleted.");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete source.");
    }
  }

  async function handleSaveManualAsset(payload: Record<string, string | number>) {
    setIsSubmitting(true);
    try {
      if (editingManualAsset) {
        await requestJson(`/api/assets/manual/${editingManualAsset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson("/api/assets/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setManualFormOpen(false);
      setEditingManualAsset(null);
      await refreshSummaryAndOpenTabs();
      toast.success("Manual asset saved.");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save manual asset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteManualAsset(assetId: number) {
    try {
      await requestJson(`/api/assets/manual/${assetId}`, { method: "DELETE" });
      await refreshSummaryAndOpenTabs();
      toast.success("Manual asset deleted.");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete manual asset.");
    }
  }

  async function handleSyncAll() {
    try {
      const response = await requestJson<{ results?: unknown[] }>("/api/assets/sync", {
        method: "POST",
      });
      await refreshSummaryAndOpenTabs();
      toast.success(`Processed ${response.results?.length ?? 0} sources.`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to sync all sources.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Assets</h1>
            <p className="mt-1 text-muted-foreground">
              Aggregate CEX, on-chain, and manual assets without mixing them into Investment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={!isAuthenticated}
            >
              <RefreshCcw className="h-4 w-4" />
              Sync All
            </Button>
          <Button onClick={() => setSourceFormOpen(true)} disabled={!isAuthenticated}>
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
            <Button variant="outline" onClick={() => setManualFormOpen(true)} disabled={!isAuthenticated}>
              <Plus className="h-4 w-4" />
              Add Manual Asset
            </Button>
          </div>
        </div>

        {!isAuthenticated ? (
          <Card className="mb-6 gap-0 border-primary/20 bg-primary/5 py-0 sm:mb-8">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Assets Preview</p>
                <p className="text-sm text-muted-foreground">
                  Browse sample sources, manual assets, allocations, and trend data before connecting real accounts.
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild size="sm">
                  <Link href="/register">Get Started</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Log in</Link>
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
                  title="By Source Type"
                  description="CEX, on-chain, and manual assets are kept distinct."
                  items={summary.sourceTypeBreakdown}
                  labelKey="type"
                />
                <AssetAllocationChart
                  title="By Category"
                  description="Current allocation by balance and position categories."
                  items={summary.categoryBreakdown}
                  labelKey="category"
                />
              </div>
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle>By Source</CardTitle>
                  <CardDescription>Sources are grouped first, with token distribution loaded on demand.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TopAssetsList
                    assets={topAssets}
                    isAuthenticated={isAuthenticated}
                    formatDisplayCurrency={formatDisplayCurrency}
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
            />
          ) : null}

          {activeTab === "balances" ? (
            <AssetBalanceTable balances={balances} positions={positions} />
          ) : null}

          {activeTab === "health" ? (
            <AssetHealthPanel failedSources={health.failedSources} syncLogs={health.syncLogs} />
          ) : null}

          {isPageLoading ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              Loading assets...
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
