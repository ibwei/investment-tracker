import { createHmac } from "node:crypto";
import { getDevelopmentProxyAgent } from "@/lib/assets/adapters/development-proxy";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";

const DEFAULT_BASE_URL = "https://api.kucoin.com";
const ACCOUNT_ENDPOINT = "/api/v1/accounts";
const ALL_TICKERS_ENDPOINT = "/api/v1/market/allTickers";
const STABLE_USD_ASSETS = new Set([
  "USD",
  "USDT",
  "USDC",
  "DAI",
  "FDUSD",
  "TUSD",
  "USDD",
  "PYUSD",
]);

type KuCoinAccount = {
  id: string;
  currency: string;
  type: string;
  balance: string;
  available: string;
  holds: string;
};

type KuCoinResponse<T> = {
  code: string;
  data: T;
  msg?: string;
};

function hmacBase64(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64");
}

function sanitizeBaseUrl(value?: string | null) {
  const baseUrl = value?.trim() || DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

function assertConfig(config: CexConfig) {
  if (!config.apiKey?.trim() || !config.apiSecret?.trim() || !config.passphrase?.trim()) {
    throw new AssetProviderError("KuCoin API key, secret, and passphrase are required.", "BAD_CONFIG");
  }
}

function classifyHttpError(status: number) {
  if (status === 401 || status === 403) {
    return "AUTH_FAILED";
  }

  if (status === 429) {
    return "RATE_LIMITED";
  }

  if (status >= 500) {
    return "PROVIDER_DOWN";
  }

  return "UNKNOWN";
}

function classifyKuCoinCode(code: string) {
  if (code === "400004" || code === "400005" || code === "400006" || code === "400007") {
    return "AUTH_FAILED";
  }

  if (code === "429000") {
    return "RATE_LIMITED";
  }

  if (code.startsWith("5")) {
    return "PROVIDER_DOWN";
  }

  return "UNKNOWN";
}

function toProviderNetworkError(error: unknown) {
  if (error instanceof AssetProviderError) {
    return error;
  }

  const cause = (error as { cause?: { code?: string; host?: string; port?: number } })?.cause;
  const message = error instanceof Error ? error.message : "Unknown network error.";
  const details = [
    cause?.code,
    cause?.host ? `${cause.host}${cause.port ? `:${cause.port}` : ""}` : "",
  ].filter(Boolean);

  return new AssetProviderError(
    `KuCoin network request failed: ${message}${details.length ? ` (${details.join(" ")})` : ""}`,
    "PROVIDER_DOWN"
  );
}

async function kucoinFetch<T>(
  config: CexConfig,
  endpoint: string,
  { signed = false }: { signed?: boolean } = {}
) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (signed) {
    const timestamp = String(Date.now());
    const method = "GET";
    const body = "";
    const prehash = `${timestamp}${method}${endpoint}${body}`;

    headers["KC-API-KEY"] = config.apiKey;
    headers["KC-API-SIGN"] = hmacBase64(config.apiSecret, prehash);
    headers["KC-API-TIMESTAMP"] = timestamp;
    headers["KC-API-PASSPHRASE"] = hmacBase64(config.apiSecret, config.passphrase || "");
    headers["KC-API-KEY-VERSION"] = config.apiKeyVersion || "2";
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "GET",
    headers,
    cache: "no-store",
    dispatcher: getDevelopmentProxyAgent(),
  } as RequestInit & { dispatcher?: ReturnType<typeof getDevelopmentProxyAgent> }).catch((error) => {
    throw toProviderNetworkError(error);
  });

  if (!response.ok) {
    throw new AssetProviderError(
      `KuCoin request failed with HTTP ${response.status}.`,
      classifyHttpError(response.status),
      response.status
    );
  }

  const payload = (await response.json()) as KuCoinResponse<T>;

  if (payload.code !== "200000") {
    throw new AssetProviderError(
      payload.msg || `KuCoin request failed with code ${payload.code}.`,
      classifyKuCoinCode(payload.code)
    );
  }

  return payload.data;
}

async function getUsdPriceMap(config: CexConfig) {
  const data = await kucoinFetch<{
    ticker: Array<{ symbol: string; last: string; averagePrice?: string }>;
  }>(config, ALL_TICKERS_ENDPOINT);
  const prices = new Map<string, number>();

  for (const symbol of STABLE_USD_ASSETS) {
    prices.set(symbol, 1);
  }

  for (const ticker of data.ticker ?? []) {
    const [base, quote] = ticker.symbol.split("-");
    if (quote !== "USDT" || !base) {
      continue;
    }

    const price = Number(ticker.last || ticker.averagePrice);
    if (Number.isFinite(price) && price > 0) {
      prices.set(base, price);
    }
  }

  return prices;
}

function aggregateAccounts(accounts: KuCoinAccount[], prices: Map<string, number>) {
  const grouped = new Map<string, KuCoinAccount[]>();

  for (const account of accounts) {
    const amount = Number(account.balance);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const key = account.currency.toUpperCase();
    grouped.set(key, [...(grouped.get(key) ?? []), account]);
  }

  return Array.from(grouped.entries()).map<NormalizedAssetBalance>(([assetSymbol, records]) => {
    const amount = records.reduce((sum, account) => sum + Number(account.balance || 0), 0);
    const price = prices.get(assetSymbol) ?? 0;

    return {
      assetSymbol,
      assetName: assetSymbol,
      amount,
      valueUsd: amount * price,
      category: "SPOT",
      rawData: {
        provider: "KUCOIN",
        accounts: records.map((account) => ({
          id: account.id,
          type: account.type,
          balance: account.balance,
          available: account.available,
          holds: account.holds,
        })),
        priceUsd: price,
      },
    };
  });
}

async function getBalances(config: CexConfig) {
  const [accounts, prices] = await Promise.all([
    kucoinFetch<KuCoinAccount[]>(config, ACCOUNT_ENDPOINT, { signed: true }),
    getUsdPriceMap(config),
  ]);

  return aggregateAccounts(accounts, prices);
}

export const kucoinAdapter: CexAdapter = {
  provider: "KUCOIN",
  async testConnection(config) {
    await kucoinFetch<KuCoinAccount[]>(config, ACCOUNT_ENDPOINT, { signed: true });
  },
  getBalances,
};
