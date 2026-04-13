import { createHash, createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "Gate";
const DEFAULT_BASE_URL = "https://api.gateio.ws/api/v4";
const SPOT_ACCOUNTS_ENDPOINT = "/spot/accounts";
const TOTAL_BALANCE_ENDPOINT = "/wallet/total_balance";
const TICKERS_ENDPOINT = "/spot/tickers";
const CORE_TIMEOUT_MS = 8000;

// Official docs:
// https://www.gate.com/docs/developers/apiv4/
// https://www.gate.com/docs/developers/apiv4/#retrieve-user-account-information
// https://www.gate.com/docs/developers/apiv4/#get-total-balance

type GateSpotAccount = {
  currency: string;
  available: string;
  locked: string;
};

type GateTicker = {
  currency_pair: string;
  last: string;
};

type GateTotalBalance = {
  total?: {
    amount?: string;
    currency?: string;
  };
  details?: Record<
    string,
    {
      amount?: string;
      currency?: string;
    }
  >;
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

async function gateFetch<T>(
  config: CexConfig,
  endpoint: string,
  signed = false,
  options: { timeoutMs?: number } = {}
) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (signed) {
    const basePath = new URL(baseUrl).pathname.replace(/\/+$/, "");
    const timestamp = String(Math.floor(Date.now() / 1000));
    const method = "GET";
    const query = "";
    const bodyHash = createHash("sha512").update("").digest("hex");
    const signaturePayload = `${method}\n${basePath}${endpoint}\n${query}\n${bodyHash}\n${timestamp}`;
    headers.KEY = config.apiKey;
    headers.Timestamp = timestamp;
    headers.SIGN = sign(config.apiSecret, signaturePayload);
  }

  const payload = await fetchJson<T & { label?: string; message?: string }>(
    PROVIDER,
    `${baseUrl}${endpoint}`,
    { method: "GET", headers, timeoutMs: options.timeoutMs }
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
  const tickers = await gateFetch<GateTicker[]>(config, TICKERS_ENDPOINT, false, {
    timeoutMs: CORE_TIMEOUT_MS,
  });
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

function normalizeSpotBalances(accounts: GateSpotAccount[], prices: Map<string, number>) {
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

function normalizeTotalBalance(totalBalance: GateTotalBalance) {
  return Object.entries(totalBalance.details ?? {})
    .map<NormalizedAssetBalance | null>(([accountType, detail]) => {
      if (accountType.toLowerCase() === "spot") {
        return null;
      }

      const valueUsd = toNumber(detail.amount);
      if (valueUsd <= 0) {
        return null;
      }

      const normalizedAccountType = accountType.toUpperCase();

      return {
        assetSymbol: `GATE_${normalizedAccountType}_TOTAL`,
        assetName: `Gate ${normalizedAccountType} Total`,
        amount: valueUsd,
        valueUsd,
        category: accountType.toLowerCase().includes("finance") ? "EARN" : "OTHER",
        rawData: {
          provider: "GATE",
          account: "total_balance",
          accountType,
          ...detail,
        },
      };
    })
    .filter((balance): balance is NormalizedAssetBalance => Boolean(balance));
}

async function getBalances(config: CexConfig) {
  const [accounts, totalBalance, prices] = await Promise.all([
    gateFetch<GateSpotAccount[]>(config, SPOT_ACCOUNTS_ENDPOINT, true, {
      timeoutMs: CORE_TIMEOUT_MS,
    }),
    gateFetch<GateTotalBalance>(config, TOTAL_BALANCE_ENDPOINT, true, {
      timeoutMs: CORE_TIMEOUT_MS,
    }),
    getUsdPriceMap(config),
  ]);

  return [...normalizeSpotBalances(accounts, prices), ...normalizeTotalBalance(totalBalance)];
}

export const gateAdapter: CexAdapter = {
  provider: "GATE",
  async testConnection(config) {
    await gateFetch<GateSpotAccount[]>(config, SPOT_ACCOUNTS_ENDPOINT, true);
  },
  getBalances,
};
