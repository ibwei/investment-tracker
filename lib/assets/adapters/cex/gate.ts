import { createHash, createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "Gate";
const DEFAULT_BASE_URL = "https://api.gateio.ws/api/v4";
const SPOT_ACCOUNTS_ENDPOINT = "/spot/accounts";
const TICKERS_ENDPOINT = "/spot/tickers";

// Official docs:
// https://www.gate.com/docs/developers/apiv4/
// https://www.gate.com/docs/developers/apiv4/#retrieve-user-account-information

type GateSpotAccount = {
  currency: string;
  available: string;
  locked: string;
};

type GateTicker = {
  currency_pair: string;
  last: string;
};

function assertConfig(config: CexConfig) {
  if (!config.apiKey?.trim() || !config.apiSecret?.trim()) {
    throw new AssetProviderError("Gate API key and secret are required.", "BAD_CONFIG");
  }
}

function classifyGateLabel(label: string | undefined) {
  if (label?.includes("INVALID_KEY") || label?.includes("SIGNATURE") || label?.includes("FORBIDDEN")) {
    return "AUTH_FAILED";
  }

  if (label?.includes("TOO_FAST") || label?.includes("RATE_LIMIT")) {
    return "RATE_LIMITED";
  }

  return "UNKNOWN";
}

function sign(secret: string, value: string) {
  return createHmac("sha512", secret).update(value).digest("hex");
}

async function gateFetch<T>(config: CexConfig, endpoint: string, signed = false) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (signed) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const method = "GET";
    const query = "";
    const bodyHash = createHash("sha512").update("").digest("hex");
    const signaturePayload = `${method}\n${endpoint}\n${query}\n${bodyHash}\n${timestamp}`;
    headers.KEY = config.apiKey;
    headers.Timestamp = timestamp;
    headers.SIGN = sign(config.apiSecret, signaturePayload);
  }

  const payload = await fetchJson<T & { label?: string; message?: string }>(
    PROVIDER,
    `${baseUrl}${endpoint}`,
    { method: "GET", headers }
  );

  if (payload.label) {
    throw new AssetProviderError(
      payload.message || `Gate request failed with label ${payload.label}.`,
      classifyGateLabel(payload.label)
    );
  }

  return payload as T;
}

async function getUsdPriceMap(config: CexConfig) {
  const tickers = await gateFetch<GateTicker[]>(config, TICKERS_ENDPOINT);
  const prices = createStablePriceMap();

  for (const ticker of tickers ?? []) {
    const [base, quote] = ticker.currency_pair.split("_");
    const price = toNumber(ticker.last);
    if (base && quote === "USDT" && price > 0) {
      prices.set(base, price);
    }
  }

  return prices;
}

function normalizeBalances(accounts: GateSpotAccount[], prices: Map<string, number>) {
  return accounts
    .map<NormalizedAssetBalance | null>((account) => {
      const assetSymbol = account.currency.toUpperCase();
      const amount = toNumber(account.available) + toNumber(account.locked);
      if (amount <= 0) {
        return null;
      }

      const price = prices.get(assetSymbol) ?? 0;

      return {
        assetSymbol,
        assetName: assetSymbol,
        amount,
        valueUsd: amount * price,
        category: "SPOT",
        rawData: {
          provider: "GATE",
          available: account.available,
          locked: account.locked,
          priceUsd: price,
        },
      };
    })
    .filter((balance): balance is NormalizedAssetBalance => Boolean(balance));
}

async function getBalances(config: CexConfig) {
  const [accounts, prices] = await Promise.all([
    gateFetch<GateSpotAccount[]>(config, SPOT_ACCOUNTS_ENDPOINT, true),
    getUsdPriceMap(config),
  ]);

  return normalizeBalances(accounts, prices);
}

export const gateAdapter: CexAdapter = {
  provider: "GATE",
  async testConnection(config) {
    await gateFetch<GateSpotAccount[]>(config, SPOT_ACCOUNTS_ENDPOINT, true);
  },
  getBalances,
};
