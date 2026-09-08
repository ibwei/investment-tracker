"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { readResource, seedResource, peekResource, invalidateResources, requestJson, RequestError } from "@/lib/client-request";
import { OperationStatus, LoadingPanel } from "@/components/ui/operation-status";
import Link from "next/link";
import { Loader2, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { AssetAllocationChart } from "@/components/assets/asset-allocation-chart";
import { AssetBalanceTable } from "@/components/assets/asset-balance-table";
const AssetHealthPanel = dynamic(() => import("@/components/assets/asset-health-panel").then(module => module.AssetHealthPanel), { loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> });
const AssetSourceForm = dynamic(() => import("@/components/assets/asset-source-form").then(module => module.AssetSourceForm), { loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> });
import { AssetSourceList } from "@/components/assets/asset-source-list";
import { AssetSummaryCards } from "@/components/assets/asset-summary-cards";
const AssetTrendChart = dynamic(() => import("@/components/assets/asset-trend-chart").then(module => module.AssetTrendChart), { loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> });
const ManualAssetForm = dynamic(() => import("@/components/assets/manual-asset-form").then(module => module.ManualAssetForm), { loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> });
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

export default function AssetsPage() {
  const { isAuthenticated, user } = useAuth();
  const scope = user?.id ? `user:${user.id}` : 'guest';
  const alive = useRef(true);
  const versions = useRef<Record<string, number>>({});
  const actionLock = useRef(false);
  const mutationController = useRef<AbortController | null>(null);
  const activeTabRef = useRef<AssetTab>('overview');
  const [tabErrors, setTabErrors] = useState<Record<string, string>>({});
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({});
  const [updatedAt, setUpdatedAt] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const { formatDisplayCurrency, t } = useI18n();
  const [activeTab, setActiveTab] = useState<AssetTab>("overview");
  const [summary, setSummary] = useState<AssetSummaryResponse | null>(() => peekResource<AssetSummaryResponse>(scope, "/api/assets/summary").data ?? null);
  const [sources, setSources] = useState<AssetSourceRecord[]>([]);
  const [manualAssets, setManualAssets] = useState<ManualAssetRecord[]>([]);
  const [balances, setBalances] = useState<AssetBalanceRecord[]>([]);
  const [positions, setPositions] = useState<AssetPositionRecord[]>([]);
  const [snapshots, setSnapshots] = useState<AssetSnapshotRecord[]>([]);
  const [health, setHealth] = useState<HealthResponse>({ failedSources: [], syncLogs: [] });
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({});
  const [trendRange, setTrendRange] = useState(30);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const isDetailLoading = Boolean(tabLoading[activeTab]);
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

  async function loadSummary(force = false) {
    if (!isAuthenticated) { setSummary(previewAssetSummary); setIsPageLoading(false); return; }
    const version = versions.current.overview = (versions.current.overview ?? 0) + 1;
    setTabLoading(current => ({ ...current, overview: true }));
    try {
      const payload = await readResource<AssetSummaryResponse>(scope, '/api/assets/summary', force);
      if (!alive.current || version !== versions.current.overview) return;
      setSummary(payload);
      setLoadedTabs(current => ({ ...current, overview: true }));
      setUpdatedAt(peekResource(scope, '/api/assets/summary').updatedAt);
      setTabErrors(current => ({ ...current, overview: '' }));
    } catch (error) {
      if (alive.current && version === versions.current.overview) setTabErrors(current => ({ ...current, overview: 'request.refreshFailed' }));
    } finally {
      if (alive.current && version === versions.current.overview) { setIsPageLoading(false); setTabLoading(current => ({ ...current, overview: false })); }
    }
  }

  async function loadTabData(tab: AssetTab, force = false) {
    if (tab === 'overview') return loadSummary(force);
    if (!isAuthenticated) {
      if (tab === 'trend') setSnapshots(previewAssetSnapshots);
      if (tab === 'sources') setSources(previewAssetSources);
      if (tab === 'manual') setManualAssets(previewManualAssets);
      if (tab === 'balances') { setBalances(previewAssetBalances); setPositions(previewAssetPositions); }
      if (tab === 'health') setHealth({ failedSources: previewAssetSources.filter(item => item.status === 'FAILED'), syncLogs: previewAssetSyncLogs });
      setLoadedTabs(current => ({ ...current, [tab]: true }));
      return;
    }
    const version = versions.current[tab] = (versions.current[tab] ?? 0) + 1;
    const isCurrent = () => alive.current && version === versions.current[tab];
    setTabLoading(current => ({ ...current, [tab]: true }));
    try {
      if (tab === 'trend') {
        const payload = await readResource<{ snapshots: AssetSnapshotRecord[] }>(scope, `/api/assets/snapshots?days=${trendRange}`, force);
        if (isCurrent()) setSnapshots(payload.snapshots);
      }
      if (tab === 'sources') {
        const payload = await readResource<{ sources: AssetSourceRecord[] }>(scope, '/api/assets/sources', force);
        if (isCurrent()) setSources(payload.sources);
      }
      if (tab === 'manual') {
        const payload = await readResource<{ assets: ManualAssetRecord[] }>(scope, '/api/assets/manual', force);
        if (isCurrent()) setManualAssets(payload.assets);
      }
      if (tab === 'balances') {
        const [balancePayload, positionPayload] = await Promise.all([
          readResource<{ balances: AssetBalanceRecord[] }>(scope, '/api/assets/balances?limit=20&offset=0&sort=valueUsd.desc', force),
          readResource<{ positions: AssetPositionRecord[] }>(scope, '/api/assets/positions?limit=20&offset=0&sort=netValueUsd.desc', force),
        ]);
        if (isCurrent()) { setBalances(balancePayload.balances); setPositions(positionPayload.positions); }
      }
      if (tab === 'health') {
        const payload = await readResource<HealthResponse>(scope, '/api/assets/health', force);
        if (isCurrent()) setHealth(payload);
      }
      if (isCurrent()) {
        setLoadedTabs(current => ({ ...current, [tab]: true }));
        setTabErrors(current => ({ ...current, [tab]: '' }));
      }
    } catch (error) {
      if (isCurrent()) setTabErrors(current => ({ ...current, [tab]: 'request.refreshFailed' }));
    } finally {
      if (isCurrent()) setTabLoading(current => ({ ...current, [tab]: false }));
    }
  }

  async function requestMutation<T>(url: string, options: RequestInit): Promise<T> {
    if (!isAuthenticated || actionLock.current || uncertain) throw new Error(uncertain ? 'request.uncertain' : 'request.pending');
    actionLock.current = true;
    mutationController.current = new AbortController();
    for (const key of ['overview', 'trend', 'sources', 'manual', 'balances', 'health']) versions.current[key] = (versions.current[key] ?? 0) + 1;
    invalidateResources(scope, '/api/assets');
    setTabLoading({});
    try {
      const response = await requestJson<T>(url, { ...options, signal: mutationController.current.signal });
      if (!alive.current) throw new Error('request.sessionChanged');
      return response;
    } catch (error) {
      if (alive.current && error instanceof RequestError && error.uncertain) { setUncertain(true); void loadSummary(true); void loadTabData(activeTabRef.current, true); }
      throw error;
    } finally { actionLock.current = false; }
  }

  function applyAssetMutationResponse(response: AssetMutationResponse) {
    if (response.summary) {
      setIsPageLoading(false);
      setUpdatedAt(Date.now());
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

  function refreshVisibleAssetData(fallbackSummary?: AssetSummaryResponse) {
    invalidateResources(scope, '/api/assets');
    for (const key of ['overview', 'trend', 'sources', 'manual', 'balances', 'health']) versions.current[key] = (versions.current[key] ?? 0) + 1;
    setTabLoading({});
    setLoadedTabs(current => ({ ...current, overview: true }));
    if (fallbackSummary) { setIsPageLoading(false); setSummary(fallbackSummary); seedResource(scope, "/api/assets/summary", fallbackSummary); setUpdatedAt(Date.now()); setTabErrors(current => ({ ...current, overview: "" })); }
    else void loadSummary(true);
    if (activeTabRef.current !== 'overview') void loadTabData(activeTabRef.current, true);
  }

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; mutationController.current?.abort(); };
  }, []);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (actionLock.current) return;
    void loadTabData(activeTab);
  }, [activeTab, trendRange, scope]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible' || actionLock.current) return;
      void loadSummary();
      if (activeTabRef.current !== 'overview') void loadTabData(activeTabRef.current);
    };
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [scope, trendRange]);

  const topAssets = useMemo(() => summary?.topAssets ?? [], [summary]);

  async function handleSaveSource(payload: Record<string, string>) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await requestMutation<AssetMutationResponse>(
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
      refreshVisibleAssetData(response.summary);
      toast.success(response.error ? t("assets.toast.saveSourceWarn") : t("assets.toast.saveSource"));
      if (response.error) {
        toast.message(response.error);
      }
    } catch (error: any) {
      if (!alive.current) return;
      toast.error(error?.message ? t(error.message) : t("assets.toast.saveSourceFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSyncSource(sourceId: number) {
    if (syncingSourceId !== null || deletingSourceId !== null || isSyncingAll) {
      return false;
    }

    setSyncingSourceId(sourceId);
    try {
      const response = await requestMutation<AssetMutationResponse>(`/api/assets/sources/${sourceId}/sync`, {
        method: "POST",
      });
      applyAssetMutationResponse(response);
      refreshVisibleAssetData(response.summary);
      if (response.error) toast.warning(t("assets.toast.syncWarn"));
      else toast.success(t("assets.toast.syncDone"));
      if (response.error) {
        toast.message(response.error);
      }
      return !response.error;
    } catch (error: any) {
      if (!alive.current) return false;
      toast.error(error?.message ? t(error.message) : t("assets.toast.syncFailed"));
      return false;
    } finally {
      setSyncingSourceId(null);
    }
  }

  async function handleDeleteSource(sourceId: number) {
    if (deletingSourceId !== null || syncingSourceId !== null || isSyncingAll) {
      return;
    }

    setDeletingSourceId(sourceId);

    try {
      const response = await requestMutation<AssetMutationResponse>(`/api/assets/sources/${sourceId}`, {
        method: "DELETE",
      });
      applyAssetMutationResponse(response);
      refreshVisibleAssetData(response.summary);
      toast.success(t("assets.toast.deleteSource"));
    } catch (error: any) {
      if (!alive.current) return;
      toast.error(error?.message ? t(error.message) : t("assets.toast.deleteSourceFailed"));
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
        response = await requestMutation<AssetMutationResponse>(`/api/assets/manual/${editingManualAsset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await requestMutation<AssetMutationResponse>("/api/assets/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setManualFormOpen(false);
      setEditingManualAsset(null);
      applyAssetMutationResponse(response);
      refreshVisibleAssetData(response.summary);
      toast.success(t("assets.toast.saveManual"));
    } catch (error: any) {
      if (!alive.current) return;
      toast.error(error?.message ? t(error.message) : t("assets.toast.saveManualFailed"));
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
      const response = await requestMutation<AssetMutationResponse>(`/api/assets/manual/${assetId}`, {
        method: "DELETE",
      });
      setManualAssets((current) => current.filter((asset) => asset.id !== assetId));
      applyAssetMutationResponse(response);
      refreshVisibleAssetData(response.summary);
      toast.success(t("assets.toast.deleteManual"));
    } catch (error: any) {
      if (!alive.current) return;
      toast.error(error?.message ? t(error.message) : t("assets.toast.deleteManualFailed"));
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
      const response = await requestMutation<AssetMutationResponse>("/api/assets/sync", {
        method: "POST",
      });
      applyAssetMutationResponse(response);
      refreshVisibleAssetData(response.summary);
      const failures = response.results?.filter(result => result.error).length ?? 0;
      if (failures === response.results?.length && failures > 0) toast.error(t('assets.toast.syncFailed'));
      else if (failures > 0) toast.warning(t('assets.toast.syncWarn'));
      else toast.success(t("assets.toast.syncAll", { count: response.results?.length ?? 0 }));
    } catch (error: any) {
      if (!alive.current) return;
      toast.error(error?.message ? t(error.message) : t("assets.toast.syncAllFailed"));
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

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
          {updatedAt ? <span>{t('request.updated', { time: new Date(updatedAt).toLocaleTimeString() })}</span> : null}
          {tabErrors.overview || tabErrors[activeTab] || uncertain ? <span role="alert">{t(uncertain ? 'request.uncertain' : tabErrors[activeTab] || tabErrors.overview)}</span> : null}
          <Button variant="ghost" size="sm" disabled={isSubmitting || isSourceActionPending} onClick={() => { void loadSummary(true); if (activeTab !== 'overview') void loadTabData(activeTab, true); }}>{t('request.refresh')}</Button>
          {uncertain ? <Button variant="outline" size="sm" onClick={() => setUncertain(false)}>{t('request.checked')}</Button> : null}
          {(tabLoading.overview || tabLoading[activeTab]) && summary ? <span role="status">{t('request.refreshing')}</span> : null}
          <OperationStatus pending={isSubmitting || isSourceActionPending || deletingManualAssetId !== null} />
        </div>
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
                    onSyncSource={handleSyncSource}
                    refreshVersion={updatedAt}
                    isActionPending={isSourceActionPending}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}

          {activeTab !== "overview" && !loadedTabs[activeTab] ? (tabErrors[activeTab] ? null : <LoadingPanel />) : <>
          {activeTab === "trend" ? (
            <AssetTrendChart
              snapshots={snapshots}
              range={trendRange}
              onRangeChange={setTrendRange}
              isLoading={isDetailLoading && !loadedTabs[activeTab]}
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
              isLoading={isDetailLoading && !loadedTabs[activeTab]}
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
              isLoading={isDetailLoading && !loadedTabs[activeTab]}
            />
          ) : null}

          {activeTab === "balances" ? (
            <AssetBalanceTable balances={balances} positions={positions} isLoading={isDetailLoading && !loadedTabs[activeTab]} />
          ) : null}

          {activeTab === "health" ? (
            <AssetHealthPanel
              failedSources={health.failedSources}
              syncLogs={health.syncLogs}
              isLoading={isDetailLoading && !loadedTabs[activeTab]}
            />
          ) : null}

          </>}
          {isPageLoading && !summary ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
              {t("assets.loading")}
            </div>
          ) : null}
        </div>
      </main>

      {sourceFormOpen && <AssetSourceForm
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
      />}
      {manualFormOpen && <ManualAssetForm
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
      />}
    </div>
  );
}
