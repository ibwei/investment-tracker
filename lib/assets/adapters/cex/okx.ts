import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "OKX";
const DEFAULT_BASE_URL = "https://www.okx.com";
const BALANCE_ENDPOINT = "/api/v5/account/balance";
const TICKERS_ENDPOINT = "/api/v5/market/tickers?instType=SPOT";

// Official docs:
// https://www.okx.com/docs-v5/en/#trading-account-rest-api-get-balance
// https://www.okx.com/docs-v5/en/#overview-rest-authentication

type OkxResponse<T> = {
  code: string;
  msg: string;
  data: T;
};

type OkxBalanceResponse = Array<{
  details?: Array<{
    ccy: string;
    cashBal?: string;
    eq?: string;
    eqUsd?: string;
    availBal?: string;
    frozenBal?: string;
  }>;
}>;

type OkxTicker = {
  instId: string;
  last: string;
};

function assertConfig(config: CexConfig) {
  if (!config.apiKey?.trim() || !config.apiSecret?.trim() || !config.passphrase?.trim()) {
    throw new AssetProviderError("OKX API key, secret, and passphrase are required.", "BAD_CONFIG");
  }
}

function classifyOkxCode(code: string) {
  if (["50113", "50114", "50115", "50116", "50117"].includes(code)) {
    return "AUTH_FAILED";
  }

  if (code === "50011") {
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

async function okxFetch<T>(config: CexConfig, endpoint: string, signed = false) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (signed) {
    const timestamp = new Date().toISOString();
    const method = "GET";
    const body = "";
    headers["OK-ACCESS-KEY"] = config.apiKey;
    headers["OK-ACCESS-SIGN"] = sign(config.apiSecret, `${timestamp}${method}${endpoint}${body}`);
    headers["OK-ACCESS-TIMESTAMP"] = timestamp;
    headers["OK-ACCESS-PASSPHRASE"] = config.passphrase || "";
  }

  const payload = await fetchJson<OkxResponse<T>>(PROVIDER, `${baseUrl}${endpoint}`, {
    method: "GET",
    headers,
  });

  if (payload.code !== "0") {
    throw new AssetProviderError(
      payload.msg || `OKX request failed with code ${payload.code}.`,
      classifyOkxCode(payload.code)
    );
  }

  return payload.data;
}

async function getUsdPriceMap(config: CexConfig) {
  const tickers = await okxFetch<OkxTicker[]>(config, TICKERS_ENDPOINT);
  const prices = createStablePriceMap();

  for (const ticker of tickers ?? []) {
    const [base, quote] = ticker.instId.split("-");
    const price = toNumber(ticker.last);
    if (base && quote === "USDT" && price > 0) {
      prices.set(base, price);
    }
  }

  return prices;
}

function normalizeBalances(data: OkxBalanceResponse, prices: Map<string, number>) {
  const details = data.flatMap((item) => item.details ?? []);

  return details
    .map<NormalizedAssetBalance | null>((detail) => {
      const assetSymbol = detail.ccy.toUpperCase();
      const amount = toNumber(detail.eq || detail.cashBal);
      if (amount <= 0) {
        return null;
      }

      const price = prices.get(assetSymbol) ?? 0;
      const valueUsd = toNumber(detail.eqUsd) || amount * price;

      return {
        assetSymbol,
        assetName: assetSymbol,
        amount,
        valueUsd,
        category: "SPOT",
        rawData: {
          provider: "OKX",
          cashBal: detail.cashBal,
          eq: detail.eq,
          eqUsd: detail.eqUsd,
          availBal: detail.availBal,
          frozenBal: detail.frozenBal,
          priceUsd: price,
        },
      };
    })
    .filter((balance): balance is NormalizedAssetBalance => Boolean(balance));
}

async function getBalances(config: CexConfig) {
  const [balances, prices] = await Promise.all([
    okxFetch<OkxBalanceResponse>(config, BALANCE_ENDPOINT, true),
    getUsdPriceMap(config),
  ]);

  return normalizeBalances(balances, prices);
}

export const okxAdapter: CexAdapter = {
  provider: "OKX",
  async testConnection(config) {
    await okxFetch<OkxBalanceResponse>(config, BALANCE_ENDPOINT, true);
  },
  getBalances,
};
