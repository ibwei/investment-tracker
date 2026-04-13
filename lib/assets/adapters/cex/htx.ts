import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "HTX";
const DEFAULT_BASE_URL = "https://api.huobi.pro";
const ACCOUNTS_ENDPOINT = "/v1/account/accounts";
const TICKERS_ENDPOINT = "/market/tickers";

// Official docs:
// https://huobiapi.github.io/docs/spot/v1/en/#get-all-accounts-of-the-current-user
// https://huobiapi.github.io/docs/spot/v1/en/#signature-method

type HtxResponse<T> = {
  status: string;
  data: T;
  "err-code"?: string;
  "err-msg"?: string;
};

type HtxAccount = {
  id: number;
  type: string;
  state: string;
};

type HtxBalanceResponse = {
  id: number;
  type: string;
  state: string;
  list?: Array<{
    currency: string;
    type: string;
    balance: string;
  }>;
};

type HtxTicker = {
  symbol: string;
  close: number;
};

function assertConfig(config: CexConfig) {
  if (!config.apiKey?.trim() || !config.apiSecret?.trim()) {
    throw new AssetProviderError("HTX API key and secret are required.", "BAD_CONFIG");
  }
}

function classifyHtxCode(code: string | undefined) {
  if (code?.includes("api-signature") || code?.includes("invalid") || code?.includes("login")) {
    return "AUTH_FAILED";
  }

  if (code?.includes("too-many") || code?.includes("rate-limit")) {
    return "RATE_LIMITED";
  }

  return "UNKNOWN";
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

function sign(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64");
}

function buildSignedQuery(config: CexConfig, host: string, endpoint: string) {
  const params: Record<string, string> = {
    AccessKeyId: config.apiKey,
    SignatureMethod: "HmacSHA256",
    SignatureVersion: "2",
    Timestamp: formatTimestamp(new Date()),
  };

  const query = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
  const payload = `GET\n${host}\n${endpoint}\n${query}`;
  const signature = sign(config.apiSecret, payload);

  return `${query}&Signature=${encodeRfc3986(signature)}`;
}

async function htxFetch<T>(config: CexConfig, endpoint: string, signed = false) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const url = new URL(baseUrl);
  const query = signed ? buildSignedQuery(config, url.host, endpoint) : "";
  const payload = await fetchJson<HtxResponse<T>>(
    PROVIDER,
    `${baseUrl}${endpoint}${query ? `?${query}` : ""}`,
    { method: "GET" }
  );

  if (payload.status !== "ok") {
    throw new AssetProviderError(
      payload["err-msg"] || `HTX request failed with code ${payload["err-code"]}.`,
      classifyHtxCode(payload["err-code"])
    );
  }

  return payload.data;
}

async function getUsdPriceMap(config: CexConfig) {
  const tickers = await htxFetch<HtxTicker[]>(config, TICKERS_ENDPOINT);
  const prices = createStablePriceMap();

  for (const ticker of tickers ?? []) {
    if (!ticker.symbol.endsWith("usdt")) {
      continue;
    }

    const assetSymbol = ticker.symbol.slice(0, -4).toUpperCase();
    const price = toNumber(ticker.close);
    if (assetSymbol && price > 0) {
      prices.set(assetSymbol, price);
    }
  }

  return prices;
}

async function getSpotAccountBalances(config: CexConfig) {
  const accounts = await htxFetch<HtxAccount[]>(config, ACCOUNTS_ENDPOINT, true);
  const spotAccounts = accounts.filter((account) => account.type === "spot" && account.state === "working");

  return Promise.all(
    spotAccounts.map((account) =>
      htxFetch<HtxBalanceResponse>(
        config,
        `/v1/account/accounts/${account.id}/balance`,
        true
      )
    )
  );
}

function normalizeBalances(accounts: HtxBalanceResponse[], prices: Map<string, number>) {
  const grouped = new Map<string, Array<{ type: string; balance: string; accountId: number }>>();

  for (const account of accounts) {
    for (const item of account.list ?? []) {
      const amount = toNumber(item.balance);
      if (amount <= 0 || item.type === "loan") {
        continue;
      }

      const assetSymbol = item.currency.toUpperCase();
      grouped.set(assetSymbol, [
        ...(grouped.get(assetSymbol) ?? []),
        { type: item.type, balance: item.balance, accountId: account.id },
      ]);
    }
  }

  return Array.from(grouped.entries()).map<NormalizedAssetBalance>(([assetSymbol, records]) => {
    const amount = records.reduce((sum, record) => sum + toNumber(record.balance), 0);
    const price = prices.get(assetSymbol) ?? 0;

    return {
      assetSymbol,
      assetName: assetSymbol,
      amount,
      valueUsd: amount * price,
      category: "SPOT",
      rawData: {
        provider: "HTX",
        balances: records,
        priceUsd: price,
      },
    };
  });
}

async function getBalances(config: CexConfig) {
  const [balances, prices] = await Promise.all([
    getSpotAccountBalances(config),
    getUsdPriceMap(config),
  ]);

  return normalizeBalances(balances, prices);
}

export const htxAdapter: CexAdapter = {
  provider: "HTX",
  async testConnection(config) {
    await htxFetch<HtxAccount[]>(config, ACCOUNTS_ENDPOINT, true);
  },
  getBalances,
};
