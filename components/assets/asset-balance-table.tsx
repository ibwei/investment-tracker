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

const MIN_VISIBLE_BALANCE_USD = 0.1;

export function AssetBalanceTable({
  balances,
  positions,
  isLoading,
}: {
  balances: AssetBalanceRecord[];
  positions: AssetPositionRecord[];
  isLoading: boolean;
}) {
  const { formatDisplayCurrency, formatDate, t } = useI18n();
  const visibleBalances = balances.filter((item) => Number(item.valueUsd ?? 0) >= MIN_VISIBLE_BALANCE_USD);
  const visiblePositions = positions.filter((item) => Number(item.netValueUsd ?? 0) >= MIN_VISIBLE_BALANCE_USD);

  return (
    <div className="grid gap-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>{t("assets.balances.balancesTitle")}</CardTitle>
          <CardDescription>{t("assets.balances.balancesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("assets.balances.headers.asset")}</TableHead>
                <TableHead>{t("assets.balances.headers.amount")}</TableHead>
                <TableHead>{t("assets.balances.headers.usdValue")}</TableHead>
                <TableHead>{t("assets.balances.headers.source")}</TableHead>
                <TableHead>{t("assets.balances.headers.category")}</TableHead>
                <TableHead>{t("assets.balances.headers.updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("assets.balances.loadingBalances")}
                    </span>
                  </TableCell>
                </TableRow>
              ) : visibleBalances.length > 0 ? (
                visibleBalances.map((item) => (
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
                    {t("assets.balances.emptyBalances")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>{t("assets.balances.positionsTitle")}</CardTitle>
          <CardDescription>{t("assets.balances.positionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("assets.balances.headers.protocol")}</TableHead>
                <TableHead>{t("assets.balances.headers.chain")}</TableHead>
                <TableHead>{t("assets.balances.headers.type")}</TableHead>
                <TableHead>{t("assets.balances.headers.netValue")}</TableHead>
                <TableHead>{t("assets.balances.headers.debt")}</TableHead>
                <TableHead>{t("assets.balances.headers.updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("assets.balances.loadingPositions")}
                    </span>
                  </TableCell>
                </TableRow>
              ) : visiblePositions.length > 0 ? (
                visiblePositions.map((item) => (
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
                    {t("assets.balances.emptyPositions")}
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
