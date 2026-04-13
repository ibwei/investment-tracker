import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "Binance";
const DEFAULT_BASE_URL = "https://api.binance.com";
const ACCOUNT_ENDPOINT = "/api/v3/account";
const TICKER_PRICE_ENDPOINT = "/api/v3/ticker/price";

// Official docs:
// https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints
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

async function binanceFetch<T>(config: CexConfig, endpoint: string, signed = false) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const headers: Record<string, string> = {
    "X-MBX-APIKEY": config.apiKey,
  };
  let query = "";

  if (signed) {
    const params = new URLSearchParams({
      timestamp: String(Date.now()),
      recvWindow: "5000",
    });
    const unsignedQuery = params.toString();
    params.set("signature", signQuery(config.apiSecret, unsignedQuery));
    query = `?${params.toString()}`;
  }

  const payload = await fetchJson<T & { code?: number; msg?: string }>(
    PROVIDER,
    `${baseUrl}${endpoint}${query}`,
    { method: "GET", headers }
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
  const tickers = await binanceFetch<BinanceTicker[]>(config, TICKER_PRICE_ENDPOINT);
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

function normalizeBalances(
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

async function getBalances(config: CexConfig) {
  const [account, prices] = await Promise.all([
    binanceFetch<BinanceAccountResponse>(config, ACCOUNT_ENDPOINT, true),
    getUsdPriceMap(config),
  ]);

  return normalizeBalances(account.balances ?? [], prices);
}

export const binanceAdapter: CexAdapter = {
  provider: "BINANCE",
  async testConnection(config) {
    await binanceFetch<BinanceAccountResponse>(config, ACCOUNT_ENDPOINT, true);
  },
  getBalances,
};
