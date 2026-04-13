"use client";

import { Database, Loader2, Pencil, RefreshCcw, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetSourceRecord } from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

function getBadgeVariant(status: string) {
  if (status === "ACTIVE") {
    return "default";
  }

  if (status === "FAILED") {
    return "destructive";
  }

  return "secondary";
}

export function AssetSourceList({
  sources,
  onSync,
  onEdit,
  onDelete,
  isAuthenticated,
  isLoading,
  syncingSourceId,
  deletingSourceId,
  isActionPending,
}: {
  sources: AssetSourceRecord[];
  onSync: (sourceId: number) => void;
  onEdit: (source: AssetSourceRecord) => void;
  onDelete: (sourceId: number) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  syncingSourceId: number | null;
  deletingSourceId: number | null;
  isActionPending: boolean;
}) {
  const { formatDisplayCurrency, formatDate } = useI18n();

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle>Asset Sources</CardTitle>
        <CardDescription>Source-level sync state stays separate from manual assets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading asset sources...
            </span>
          </div>
        ) : sources.length > 0 ? (
          sources.map((source) => {
            const isSyncing = syncingSourceId === source.id;
            const isDeleting = deletingSourceId === source.id;
            const isBusy = isLoading || isActionPending;

            return (
              <div
                key={source.id}
                className="rounded-lg border border-border/60 bg-background/50 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium">{source.name}</h3>
                      <Badge variant={getBadgeVariant(source.status)}>{source.status}</Badge>
                      <Badge variant="outline">{source.type}</Badge>
                      <Badge variant="outline">{source.provider}</Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        {source.balanceCount ?? 0} balances / {source.positionCount ?? 0} positions
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        {formatDisplayCurrency(source.totalValueUsd ?? 0)}
                      </div>
                      <div>Last sync: {source.lastSyncedAt ? formatDate(source.lastSyncedAt) : "Never"}</div>
                      {source.publicRef ? <div className="truncate">Ref: {source.publicRef}</div> : null}
                    </div>
                    {source.lastError ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {source.lastError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(source)}
                      disabled={!isAuthenticated || isBusy}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSync(source.id)}
                      disabled={!isAuthenticated || isBusy}
                      loading={isSyncing}
                    >
                      {isSyncing ? null : <RefreshCcw className="h-4 w-4" />}
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(source.id)}
                      disabled={!isAuthenticated || isBusy}
                      loading={isDeleting}
                    >
                      {isDeleting ? null : <Trash2 className="h-4 w-4" />}
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No asset sources yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
