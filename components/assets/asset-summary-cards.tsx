"use client";

import { AlertCircle, Database, RefreshCcw, Wallet, Wrench, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AssetSummaryResponse } from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

export function AssetSummaryCards({ summary }: { summary: AssetSummaryResponse["summary"] }) {
  const { formatDisplayCurrency, formatDate, t } = useI18n();
  const changeValue =
    summary.changePercent >= 0 ? `+${summary.changePercent.toFixed(2)}` : summary.changePercent.toFixed(2);

  const cards = [
    {
      title: t("assets.summary.total"),
      value: formatDisplayCurrency(summary.totalValueUsd),
      description: summary.snapshotDate ? formatDate(summary.snapshotDate) : t("assets.summary.noSnapshot"),
      icon: Wallet,
    },
    {
      title: t("assets.summary.change"),
      value: formatDisplayCurrency(summary.changeUsd),
      description: t("assets.summary.changePercent", { value: changeValue }),
      icon: TrendingUp,
    },
    {
      title: t("assets.summary.sources"),
      value: String(summary.sourceCount),
      description: t("assets.summary.sourcesDescription"),
      icon: Database,
    },
    {
      title: t("assets.summary.manual"),
      value: String(summary.manualAssetCount),
      description: t("assets.summary.manualDescription"),
      icon: Wrench,
    },
    {
      title: t("assets.summary.failed"),
      value: String(summary.failedSourceCount),
      description: t("assets.summary.failedDescription"),
      icon: AlertCircle,
    },
    {
      title: t("assets.summary.lastSync"),
      value: summary.lastSyncedAt ? formatDate(summary.lastSyncedAt) : t("assets.summary.never"),
      description: t("assets.summary.lastSyncDescription"),
      icon: RefreshCcw,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title} className="gap-0 border-border/50 bg-card/50 py-0 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-xl font-semibold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
