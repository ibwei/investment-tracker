"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManualAssetRecord } from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

export function ManualAssetList({
  assets,
  onEdit,
  onDelete,
  isAuthenticated,
  deletingAssetId,
  isLoading,
}: {
  assets: ManualAssetRecord[];
  onEdit: (asset: ManualAssetRecord) => void;
  onDelete: (assetId: number) => void;
  isAuthenticated: boolean;
  deletingAssetId: number | null;
  isLoading: boolean;
}) {
  const { formatDisplayCurrency, formatDate, t } = useI18n();

  function getTypeLabel(type: string) {
    switch (type) {
      case "CASH":
        return t("assets.manualAssets.types.cash");
      case "STOCK":
        return t("assets.manualAssets.types.stock");
      case "FUND":
        return t("assets.manualAssets.types.fund");
      case "TOKEN":
        return t("assets.manualAssets.types.token");
      case "REAL_ESTATE":
        return t("assets.manualAssets.types.realEstate");
      case "OTHER":
        return t("assets.manualAssets.types.other");
      default:
        return type;
    }
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle>{t("assets.manualAssets.title")}</CardTitle>
        <CardDescription>{t("assets.manualAssets.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("assets.manualAssets.headers.name")}</TableHead>
              <TableHead>{t("assets.manualAssets.headers.type")}</TableHead>
              <TableHead>{t("assets.manualAssets.headers.amount")}</TableHead>
              <TableHead>{t("assets.manualAssets.headers.usdValue")}</TableHead>
              <TableHead>{t("assets.manualAssets.headers.note")}</TableHead>
              <TableHead>{t("assets.manualAssets.headers.updated")}</TableHead>
              <TableHead>{t("assets.manualAssets.headers.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("assets.manualAssets.loading")}
                  </span>
                </TableCell>
              </TableRow>
            ) : assets.length > 0 ? (
              assets.map((asset) => {
                const isDeleting = deletingAssetId === asset.id;
                const isBusy = deletingAssetId !== null;

                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{getTypeLabel(asset.type)}</TableCell>
                    <TableCell>{asset.amount}</TableCell>
                    <TableCell>{formatDisplayCurrency(asset.valueUsd)}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{asset.note || "-"}</TableCell>
                    <TableCell>{formatDate(asset.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(asset)}
                          disabled={!isAuthenticated || isBusy}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("assets.sources.edit")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(asset.id)}
                          disabled={!isAuthenticated || isBusy}
                          loading={isDeleting}
                        >
                          {isDeleting ? null : <Trash2 className="h-4 w-4" />}
                          {t("assets.sources.delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {t("assets.manualAssets.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
