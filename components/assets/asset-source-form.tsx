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

const CEX_PROVIDERS = ["BINANCE", "OKX", "BYBIT", "BITGET", "GATE", "HTX", "KUCOIN"];
const ONCHAIN_PROVIDERS = ["AUTO", "EVM", "SOLANA", "SUI"];
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
          <DialogTitle>{source ? "Edit Asset Source" : "Add Asset Source"}</DialogTitle>
          <DialogDescription>
            Use read-only API keys only. No trading or withdrawal permissions are needed.
            {source?.type === "CEX"
              ? " Leave credential fields empty to keep the saved API key."
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="source-type">Source Type</Label>
            <Select
              value={values.type}
              disabled={Boolean(source)}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  type: value,
                  provider: value === "CEX" ? "BINANCE" : "AUTO",
                }))
              }
            >
              <SelectTrigger id="source-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CEX">CEX</SelectItem>
                <SelectItem value="ONCHAIN">On-chain</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source-provider">Provider</Label>
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
            <Label htmlFor="source-name">Name</Label>
            <Input
              id="source-name"
              value={values.name}
              onChange={(event) =>
                setValues((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Optional, defaults to provider name"
            />
          </div>

          {values.type === "CEX" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="api-key">API Key</Label>
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
                <Label htmlFor="api-secret">API Secret</Label>
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
                  Passphrase {PASSPHRASE_REQUIRED.has(values.provider) ? "(required)" : "(optional)"}
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
                  <Label htmlFor="api-key-version">API Key Version</Label>
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
                    Use the version shown in KuCoin API Management. New app-created keys may show 3.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="wallet-address">Wallet Address</Label>
              <Input
                id="wallet-address"
                value={values.publicRef}
                onChange={(event) =>
                  setValues((current) => ({ ...current, publicRef: event.target.value }))
                }
                placeholder="0x... or Solana/Sui address"
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {source ? "Save Changes" : "Save Source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
