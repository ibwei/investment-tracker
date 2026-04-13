"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetSourceRecord, AssetSyncLogRecord } from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

export function AssetHealthPanel({
  failedSources,
  syncLogs,
}: {
  failedSources: AssetSourceRecord[];
  syncLogs: AssetSyncLogRecord[];
}) {
  const { formatDate } = useI18n();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Failed Sources</CardTitle>
          <CardDescription>Only sanitized error summaries are shown here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {failedSources.length > 0 ? (
            failedSources.map((source) => (
              <div key={source.id} className="rounded-lg border border-border/60 bg-background/50 p-4">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{source.name}</div>
                  <Badge variant="destructive">{source.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{source.lastError || "Unknown error"}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No source issues right now.</p>
          )}
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Recent Sync Logs</CardTitle>
          <CardDescription>Latest sync attempts for this user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {syncLogs.length > 0 ? (
            syncLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border/60 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{log.sourceName || "All Sources"}</div>
                  <Badge variant={log.status === "FAILED" ? "destructive" : "default"}>
                    {log.status}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  <div>{formatDate(log.createdAt)}</div>
                  {log.errorMessage ? <div className="mt-1">{log.errorMessage}</div> : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No sync logs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
