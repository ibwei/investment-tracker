"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ManualAssetRecord } from "@/lib/assets/types";

const initialState = {
  name: "",
  type: "CASH",
  amount: "",
  valueUsd: "",
  note: "",
};

export function ManualAssetForm({
  open,
  onOpenChange,
  asset,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: ManualAssetRecord | null;
  onSubmit: (payload: Record<string, string | number>) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [values, setValues] = useState(initialState);

  useEffect(() => {
    if (asset) {
      setValues({
        name: asset.name,
        type: asset.type,
        amount: String(asset.amount),
        valueUsd: String(asset.valueUsd),
        note: asset.note || "",
      });
      return;
    }

    setValues(initialState);
  }, [asset, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...values,
      amount: Number(values.amount),
      valueUsd: Number(values.valueUsd),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset ? "Edit Manual Asset" : "Add Manual Asset"}</DialogTitle>
          <DialogDescription>
            USD value is the number that contributes to total assets, allocation, and snapshots.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="manual-name">Name</Label>
            <Input
              id="manual-name"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="VOO ETF"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual-type">Type</Label>
            <Select
              value={values.type}
              onValueChange={(value) => setValues((current) => ({ ...current, type: value }))}
            >
              <SelectTrigger id="manual-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["CASH", "STOCK", "FUND", "TOKEN", "REAL_ESTATE", "OTHER"].map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="manual-amount">Amount</Label>
              <Input
                id="manual-amount"
                type="number"
                min="0"
                step="any"
                value={values.amount}
                onChange={(event) =>
                  setValues((current) => ({ ...current, amount: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-value-usd">USD Value</Label>
              <Input
                id="manual-value-usd"
                type="number"
                min="0"
                step="any"
                value={values.valueUsd}
                onChange={(event) =>
                  setValues((current) => ({ ...current, valueUsd: event.target.value }))
                }
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual-note">Note</Label>
            <Textarea
              id="manual-note"
              value={values.note}
              onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
              placeholder="Valuation basis or update reminder"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save Asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
