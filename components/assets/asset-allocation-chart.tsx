"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

const COLORS = [
  "oklch(0.72 0.16 150)",
  "oklch(0.69 0.16 215)",
  "oklch(0.77 0.16 90)",
  "oklch(0.71 0.14 30)",
  "oklch(0.67 0.15 340)",
];

export function AssetAllocationChart({
  title,
  description,
  items,
  labelKey,
}: {
  title: string;
  description: string;
  items: Array<Record<string, string | number>>;
  labelKey: string;
}) {
  const { formatDisplayCurrency } = useI18n();

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="h-[260px] min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="valueUsd"
                nameKey={labelKey}
                innerRadius={60}
                outerRadius={92}
                paddingAngle={2}
              >
                {items.map((item, index) => (
                  <Cell key={String(item[labelKey])} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [formatDisplayCurrency(value), "Value"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {items.length > 0 ? (
            items.map((item, index) => (
              <div key={String(item[labelKey])} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate text-sm">{String(item[labelKey])}</span>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{formatDisplayCurrency(Number(item.valueUsd ?? 0))}</div>
                  <div className="text-muted-foreground">{Number(item.percentage ?? 0).toFixed(2)}%</div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
