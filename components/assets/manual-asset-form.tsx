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
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

  const typeOptions = [
    { value: "CASH", label: t("assets.manualAssets.types.cash") },
    { value: "STOCK", label: t("assets.manualAssets.types.stock") },
    { value: "FUND", label: t("assets.manualAssets.types.fund") },
    { value: "TOKEN", label: t("assets.manualAssets.types.token") },
    { value: "REAL_ESTATE", label: t("assets.manualAssets.types.realEstate") },
    { value: "OTHER", label: t("assets.manualAssets.types.other") },
  ];

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
          <DialogTitle>
            {asset ? t("assets.forms.editManualTitle") : t("assets.forms.addManualTitle")}
          </DialogTitle>
          <DialogDescription>{t("assets.forms.manualDescription")}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="manual-name">{t("assets.forms.name")}</Label>
            <Input
              id="manual-name"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("assets.forms.manualNamePlaceholder")}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual-type">{t("assets.manualAssets.headers.type")}</Label>
            <Select
              value={values.type}
              onValueChange={(value) => setValues((current) => ({ ...current, type: value }))}
            >
              <SelectTrigger id="manual-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="manual-amount">{t("assets.forms.amount")}</Label>
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
              <Label htmlFor="manual-value-usd">{t("assets.forms.valueUsd")}</Label>
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
            <Label htmlFor="manual-note">{t("assets.forms.note")}</Label>
            <Textarea
              id="manual-note"
              value={values.note}
              onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
              placeholder={t("assets.forms.notePlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("assets.forms.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("assets.forms.saveAsset")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
