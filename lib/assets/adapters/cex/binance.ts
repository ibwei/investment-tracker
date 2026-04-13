import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "Binance";
const DEFAULT_BASE_URL = "https://api.binance.com";
const ACCOUNT_ENDPOINT = "/api/v3/account";
const SIMPLE_EARN_FLEXIBLE_ENDPOINT = "/sapi/v1/simple-earn/flexible/position";
const SIMPLE_EARN_LOCKED_ENDPOINT = "/sapi/v1/simple-earn/locked/position";
const TICKER_PRICE_ENDPOINT = "/api/v3/ticker/price";
const CORE_TIMEOUT_MS = 8000;
const EARN_TIMEOUT_MS = 12000;

// Official docs:
// https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints
// https://developers.binance.com/docs/simple_earn/account/Get-Flexible-Product-Position
// https://developers.binance.com/docs/simple_earn/account/Get-Locked-Product-Position
// https://developers.binance.com/docs/binance-spot-api-docs/rest-api/request-security

type BinanceAccountResponse = {
  balances?: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  code?: number;
  msg?: string;
};

type BinanceEarnPositionResponse = {
  rows?: Array<{
    asset: string;
    amount?: string;
    totalAmount?: string;
    productId?: string;
    positionId?: string;
    projectId?: string;
  }>;
};

type BinanceTicker = {
  symbol: string;
  price: string;
};

function assertConfig(config: CexConfig) {
  if (!config.apiKey?.trim() || !config.apiSecret?.trim()) {
    throw new AssetProviderError("Binance API key and secret are required.", "BAD_CONFIG");
  }
}

function classifyBinanceCode(code: number | undefined) {
  if (code === -2014 || code === -2015 || code === -1022 || code === -1021) {
    return "AUTH_FAILED";
  }

  if (code === -1003) {
    return "RATE_LIMITED";
  }

  if (code === -1000 || code === -1001) {
    return "PROVIDER_DOWN";
  }

  return "UNKNOWN";
}

function signQuery(secret: string, query: string) {
  return createHmac("sha256", secret).update(query).digest("hex");
}

async function binanceFetch<T>(
  config: CexConfig,
  endpoint: string,
  {
    signed = false,
    params = new URLSearchParams(),
    timeoutMs,
  }: { signed?: boolean; params?: URLSearchParams; timeoutMs?: number } = {}
) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const headers: Record<string, string> = {
    "X-MBX-APIKEY": config.apiKey,
  };
  const queryParams = new URLSearchParams(params);

  if (signed) {
    queryParams.set("timestamp", String(Date.now()));
    queryParams.set("recvWindow", queryParams.get("recvWindow") || "5000");
    const unsignedQuery = queryParams.toString();
    queryParams.set("signature", signQuery(config.apiSecret, unsignedQuery));
  }

  const query = queryParams.size ? `?${queryParams.toString()}` : "";

  const payload = await fetchJson<T & { code?: number; msg?: string }>(
    PROVIDER,
    `${baseUrl}${endpoint}${query}`,
    { method: "GET", headers, timeoutMs }
  );

  if (payload.code && payload.code < 0) {
    throw new AssetProviderError(
      payload.msg || `Binance request failed with code ${payload.code}.`,
      classifyBinanceCode(payload.code)
    );
  }

  return payload as T;
}

async function getUsdPriceMap(config: CexConfig) {
  const tickers = await binanceFetch<BinanceTicker[]>(config, TICKER_PRICE_ENDPOINT, {
    timeoutMs: CORE_TIMEOUT_MS,
  });
  const prices = createStablePriceMap();

  for (const ticker of tickers ?? []) {
    if (!ticker.symbol.endsWith("USDT")) {
      continue;
    }

    const assetSymbol = ticker.symbol.slice(0, -4);
    const price = toNumber(ticker.price);
    if (assetSymbol && price > 0) {
      prices.set(assetSymbol, price);
    }
  }

  return prices;
}

function normalizeSpotBalances(
  balances: NonNullable<BinanceAccountResponse["balances"]>,
  prices: Map<string, number>
) {
  return balances
    .map<NormalizedAssetBalance | null>((balance) => {
      const assetSymbol = balance.asset.toUpperCase();
      const amount = toNumber(balance.free) + toNumber(balance.locked);
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
          provider: "BINANCE",
          free: balance.free,
          locked: balance.locked,
          priceUsd: price,
        },
      };
    })
    .filter((balance): balance is NormalizedAssetBalance => Boolean(balance));
}

function normalizeEarnBalances(
  flexible: BinanceEarnPositionResponse,
  locked: BinanceEarnPositionResponse,
  prices: Map<string, number>
) {
  const grouped = new Map<string, Array<{ account: string; amount: string; productId?: string }>>();

  for (const [account, rows] of [
    ["simple_earn_flexible", flexible.rows ?? []],
    ["simple_earn_locked", locked.rows ?? []],
  ] as const) {
    for (const row of rows) {
      const amount = toNumber(row.totalAmount || row.amount);
      if (amount <= 0) {
        continue;
      }

      const assetSymbol = row.asset.toUpperCase();
      grouped.set(assetSymbol, [
        ...(grouped.get(assetSymbol) ?? []),
        {
          account,
          amount: String(row.totalAmount || row.amount || "0"),
          productId: row.productId || row.projectId || row.positionId,
        },
      ]);
    }
  }

  return Array.from(grouped.entries()).map<NormalizedAssetBalance>(([assetSymbol, records]) => {
    const amount = records.reduce((sum, record) => sum + toNumber(record.amount), 0);
    const price = prices.get(assetSymbol) ?? 0;

    return {
      assetSymbol,
      assetName: assetSymbol,
      amount,
      valueUsd: amount * price,
      category: "EARN",
      rawData: {
        provider: "BINANCE",
        accounts: records,
        priceUsd: price,
      },
    };
  });
}

async function getBalances(config: CexConfig) {
  const [account, flexibleEarn, lockedEarn, prices] = await Promise.all([
    binanceFetch<BinanceAccountResponse>(config, ACCOUNT_ENDPOINT, {
      signed: true,
      timeoutMs: CORE_TIMEOUT_MS,
    }),
    binanceFetch<BinanceEarnPositionResponse>(config, SIMPLE_EARN_FLEXIBLE_ENDPOINT, {
      signed: true,
      params: new URLSearchParams({ current: "1", size: "100" }),
      timeoutMs: EARN_TIMEOUT_MS,
    }),
    binanceFetch<BinanceEarnPositionResponse>(config, SIMPLE_EARN_LOCKED_ENDPOINT, {
      signed: true,
      params: new URLSearchParams({ current: "1", size: "100" }),
      timeoutMs: EARN_TIMEOUT_MS,
    }),
    getUsdPriceMap(config),
  ]);

  return [
    ...normalizeSpotBalances(account.balances ?? [], prices),
    ...normalizeEarnBalances(flexibleEarn, lockedEarn, prices),
  ];
}

export const binanceAdapter: CexAdapter = {
  provider: "BINANCE",
  async testConnection(config) {
    await binanceFetch<BinanceAccountResponse>(config, ACCOUNT_ENDPOINT, { signed: true });
  },
  getBalances,
};
