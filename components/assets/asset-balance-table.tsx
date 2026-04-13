"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AssetBalanceRecord, AssetPositionRecord } from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

export function AssetBalanceTable({
  balances,
  positions,
  isLoading,
}: {
  balances: AssetBalanceRecord[];
  positions: AssetPositionRecord[];
  isLoading: boolean;
}) {
  const { formatDisplayCurrency, formatDate } = useI18n();

  return (
    <div className="grid gap-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Asset Balances</CardTitle>
          <CardDescription>Loaded only when the balances tab is opened.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>USD Value</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading balances...
                    </span>
                  </TableCell>
                </TableRow>
              ) : balances.length > 0 ? (
                balances.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.assetSymbol}
                      {item.assetName ? (
                        <span className="ml-2 text-muted-foreground">{item.assetName}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{item.amount}</TableCell>
                    <TableCell>{formatDisplayCurrency(item.valueUsd)}</TableCell>
                    <TableCell>{item.sourceName || "-"}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No balance data yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>DeFi Positions</CardTitle>
          <CardDescription>Net value uses asset value plus rewards minus debt.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocol</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Net Value</TableHead>
                <TableHead>Debt</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading positions...
                    </span>
                  </TableCell>
                </TableRow>
              ) : positions.length > 0 ? (
                positions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.protocolName || item.provider}</TableCell>
                    <TableCell>{item.chain || "-"}</TableCell>
                    <TableCell>{item.positionType}</TableCell>
                    <TableCell>{formatDisplayCurrency(item.netValueUsd)}</TableCell>
                    <TableCell>{formatDisplayCurrency(item.debtValueUsd)}</TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No position data yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
