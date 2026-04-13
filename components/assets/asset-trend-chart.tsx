"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetSnapshotRecord } from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

export function AssetTrendChart({
  snapshots,
  range,
  onRangeChange,
  isLoading,
}: {
  snapshots: AssetSnapshotRecord[];
  range: number;
  onRangeChange: (days: number) => void;
  isLoading: boolean;
}) {
  const { formatDate, formatDisplayCurrency } = useI18n();

  const chartData = useMemo(
    () =>
      snapshots.map((item) => ({
        ...item,
        label: formatDate(item.snapshotDate, { month: "short", day: "numeric" }),
      })),
    [formatDate, snapshots]
  );

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Asset Trend</CardTitle>
          <CardDescription>Snapshot history is fetched on demand and defaults to 30 days.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => (
            <Button
              key={days}
              variant={range === days ? "default" : "outline"}
              size="sm"
              onClick={() => onRangeChange(days)}
            >
              {days}D
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[320px] min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "oklch(0.6 0 0)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={96}
                  tick={{ fill: "oklch(0.6 0 0)", fontSize: 12 }}
                  tickFormatter={(value) => formatDisplayCurrency(value, 0)}
                />
                <Tooltip
                  formatter={(value: number) => [formatDisplayCurrency(value), "Total Assets"]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "oklch(0.15 0.005 260)",
                    border: "1px solid oklch(0.25 0.005 260)",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalValueUsd"
                  stroke="oklch(0.72 0.16 150)"
                  fill="oklch(0.72 0.16 150 / 0.18)"
                  strokeWidth={2.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
            {isLoading ? "Loading trend..." : "No snapshot data yet."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
