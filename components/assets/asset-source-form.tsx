"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { AssetSourceRecord } from "@/lib/assets/types";
import { useI18n } from "@/lib/i18n";

const CEX_PROVIDERS = ["BINANCE", "OKX", "BYBIT", "BITGET", "GATE", "HTX", "KUCOIN"];
const ONCHAIN_PROVIDERS = [
  "OKX_WEB3",
  "AUTO",
  "OKX_EVM",
  "OKX_SOLANA",
  "OKX_SUI",
  "OKX_TRON",
  "OKX_BITCOIN",
  "OKX_TON",
];
const PASSPHRASE_REQUIRED = new Set(["OKX", "BITGET", "KUCOIN"]);

const initialState = {
  type: "CEX",
  provider: "BINANCE",
  name: "",
  publicRef: "",
  apiKey: "",
  apiSecret: "",
  passphrase: "",
  apiKeyVersion: "3",
};

export function AssetSourceForm({
  open,
  onOpenChange,
  source,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: AssetSourceRecord | null;
  onSubmit: (payload: Record<string, string>) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [values, setValues] = useState(initialState);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) {
      setValues(initialState);
      return;
    }

    if (source) {
      setValues({
        ...initialState,
        type: source.type,
        provider: source.provider,
        name: source.name,
        publicRef: source.publicRef ?? "",
      });
    }
  }, [open, source]);

  const providers = useMemo(
    () => (values.type === "CEX" ? CEX_PROVIDERS : ONCHAIN_PROVIDERS),
    [values.type]
  );

  useEffect(() => {
    if (!providers.includes(values.provider)) {
      setValues((current) => ({
        ...current,
        provider: providers[0],
      }));
    }
  }, [providers, values.provider]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {source ? t("assets.forms.editSourceTitle") : t("assets.forms.addSourceTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("assets.forms.sourceDescription")}
            {source?.type === "CEX" ? ` ${t("assets.forms.sourceEditHint")}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="source-type">{t("assets.forms.sourceType")}</Label>
            <Select
              value={values.type}
              disabled={Boolean(source)}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  type: value,
                  provider: value === "CEX" ? "BINANCE" : "OKX_WEB3",
                }))
              }
            >
              <SelectTrigger id="source-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CEX">{t("assets.forms.sourceTypeCex")}</SelectItem>
                <SelectItem value="ONCHAIN">{t("assets.forms.sourceTypeOnchain")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source-provider">{t("assets.forms.provider")}</Label>
            <Select
              value={values.provider}
              disabled={Boolean(source)}
              onValueChange={(value) => setValues((current) => ({ ...current, provider: value }))}
            >
              <SelectTrigger id="source-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source-name">{t("assets.forms.name")}</Label>
            <Input
              id="source-name"
              value={values.name}
              onChange={(event) =>
                setValues((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t("assets.forms.namePlaceholder")}
            />
          </div>

          {values.type === "CEX" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="api-key">{t("assets.forms.apiKey")}</Label>
                <Input
                  id="api-key"
                  value={values.apiKey}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, apiKey: event.target.value }))
                  }
                  required={!source}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="api-secret">{t("assets.forms.apiSecret")}</Label>
                <Input
                  id="api-secret"
                  type="password"
                  value={values.apiSecret}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, apiSecret: event.target.value }))
                  }
                  required={!source}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="passphrase">
                  {PASSPHRASE_REQUIRED.has(values.provider)
                    ? t("assets.forms.passphraseRequired")
                    : t("assets.forms.passphraseOptional")}
                </Label>
                <Input
                  id="passphrase"
                  type="password"
                  value={values.passphrase}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, passphrase: event.target.value }))
                  }
                  required={!source && PASSPHRASE_REQUIRED.has(values.provider)}
                />
              </div>
              {values.provider === "KUCOIN" ? (
                <div className="grid gap-2">
                  <Label htmlFor="api-key-version">{t("assets.forms.apiKeyVersion")}</Label>
                  <Input
                    id="api-key-version"
                    value={values.apiKeyVersion}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        apiKeyVersion: event.target.value,
                      }))
                    }
                    placeholder="3"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("assets.forms.apiKeyVersionHint")}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="wallet-address">{t("assets.forms.walletAddress")}</Label>
              <Input
                id="wallet-address"
                value={values.publicRef}
                onChange={(event) =>
                  setValues((current) => ({ ...current, publicRef: event.target.value }))
                }
                placeholder={t("assets.forms.walletPlaceholder")}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("assets.forms.walletHint")}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("assets.forms.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {source ? t("assets.forms.saveChanges") : t("assets.forms.saveSource")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
