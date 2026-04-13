"use client";

import { Pencil, Trash2 } from "lucide-react";
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
}: {
  assets: ManualAssetRecord[];
  onEdit: (asset: ManualAssetRecord) => void;
  onDelete: (assetId: number) => void;
  isAuthenticated: boolean;
}) {
  const { formatDisplayCurrency, formatDate } = useI18n();

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle>Manual Assets</CardTitle>
        <CardDescription>USD value is the amount used in aggregation and snapshots.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>USD Value</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length > 0 ? (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>{asset.type}</TableCell>
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
                        disabled={!isAuthenticated}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(asset.id)}
                        disabled={!isAuthenticated}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No manual assets yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
