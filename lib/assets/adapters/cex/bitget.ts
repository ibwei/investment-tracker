import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "Bitget";
const DEFAULT_BASE_URL = "https://api.bitget.com";
const ASSETS_ENDPOINT = "/api/v2/spot/account/assets";
const TICKERS_ENDPOINT = "/api/v2/spot/market/tickers";

// Official docs:
// https://www.bitget.com/api-doc/common/quick-start
// https://www.bitget.com/api-doc/spot/account/Get-Account-Assets

type BitgetResponse<T> = {
  code: string;
  msg: string;
  data: T;
};

type BitgetAsset = {
  coin: string;
  available?: string;
  frozen?: string;
  locked?: string;
  limitAvailable?: string;
};

type BitgetTicker = {
  symbol: string;
  lastPr?: string;
  close?: string;
};

function assertConfig(config: CexConfig) {
  if (!config.apiKey?.trim() || !config.apiSecret?.trim() || !config.passphrase?.trim()) {
    throw new AssetProviderError("Bitget API key, secret, and passphrase are required.", "BAD_CONFIG");
  }
}

function classifyBitgetCode(code: string) {
  if (["40001", "40002", "40003", "40004", "40005", "40006", "40009", "40012"].includes(code)) {
    return "AUTH_FAILED";
  }

  if (code === "429" || code === "40010") {
    return "RATE_LIMITED";
  }

  if (code.startsWith("5")) {
    return "PROVIDER_DOWN";
  }

  return "UNKNOWN";
}

function sign(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64");
}

async function bitgetFetch<T>(config: CexConfig, endpoint: string, signed = false) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    locale: "en-US",
  };

  if (signed) {
    const timestamp = String(Date.now());
    const method = "GET";
    const body = "";
    headers["ACCESS-KEY"] = config.apiKey;
    headers["ACCESS-SIGN"] = sign(config.apiSecret, `${timestamp}${method}${endpoint}${body}`);
    headers["ACCESS-TIMESTAMP"] = timestamp;
    headers["ACCESS-PASSPHRASE"] = config.passphrase || "";
  }

  const payload = await fetchJson<BitgetResponse<T>>(PROVIDER, `${baseUrl}${endpoint}`, {
    method: "GET",
    headers,
  });

  if (payload.code !== "00000") {
    throw new AssetProviderError(
      payload.msg || `Bitget request failed with code ${payload.code}.`,
      classifyBitgetCode(payload.code)
    );
  }

  return payload.data;
}

async function getUsdPriceMap(config: CexConfig) {
  const tickers = await bitgetFetch<BitgetTicker[]>(config, TICKERS_ENDPOINT);
  const prices = createStablePriceMap();

  for (const ticker of tickers ?? []) {
    if (!ticker.symbol.endsWith("USDT")) {
      continue;
    }

    const assetSymbol = ticker.symbol.slice(0, -4);
    const price = toNumber(ticker.lastPr || ticker.close);
    if (assetSymbol && price > 0) {
      prices.set(assetSymbol, price);
    }
  }

  return prices;
}

function normalizeBalances(assets: BitgetAsset[], prices: Map<string, number>) {
  return assets
    .map<NormalizedAssetBalance | null>((asset) => {
      const assetSymbol = asset.coin.toUpperCase();
      const amount =
        toNumber(asset.available) +
        toNumber(asset.frozen) +
        toNumber(asset.locked) +
        toNumber(asset.limitAvailable);

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
          provider: "BITGET",
          available: asset.available,
          frozen: asset.frozen,
          locked: asset.locked,
          limitAvailable: asset.limitAvailable,
          priceUsd: price,
        },
      };
    })
    .filter((balance): balance is NormalizedAssetBalance => Boolean(balance));
}

async function getBalances(config: CexConfig) {
  const [assets, prices] = await Promise.all([
    bitgetFetch<BitgetAsset[]>(config, ASSETS_ENDPOINT, true),
    getUsdPriceMap(config),
  ]);

  return normalizeBalances(assets, prices);
}

export const bitgetAdapter: CexAdapter = {
  provider: "BITGET",
  async testConnection(config) {
    await bitgetFetch<BitgetAsset[]>(config, ASSETS_ENDPOINT, true);
  },
  getBalances,
};
