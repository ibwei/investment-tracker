import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "Bybit";
const DEFAULT_BASE_URL = "https://api.bybit.com";
const WALLET_BALANCE_ENDPOINT = "/v5/account/wallet-balance";
const ACCOUNT_COINS_BALANCE_ENDPOINT = "/v5/asset/transfer/query-account-coins-balance";
const TICKERS_ENDPOINT = "/v5/market/tickers";
const RECV_WINDOW = "5000";
const ACCOUNT_TYPES = ["UNIFIED", "CONTRACT", "SPOT"];
const CORE_TIMEOUT_MS = 8000;

// Official docs:
// https://bybit-exchange.github.io/docs/v5/account/wallet-balance
// https://bybit-exchange.github.io/docs/v5/asset/balance/all-balance
// https://bybit-exchange.github.io/docs/v5/guide

type BybitResponse<T> = {
  retCode: number;
  retMsg: string;
  result: T;
};

type BybitWalletResult = {
  list?: Array<{
    accountType: string;
    coin?: Array<{
      coin: string;
      walletBalance?: string;
      transferBalance?: string;
      locked?: string;
      usdValue?: string;
    }>;
  }>;
};

type BybitTickerResult = {
  list?: Array<{
    symbol: string;
    lastPrice: string;
  }>;
};

type BybitCoinBalanceResult = {
  accountType?: string;
  balance?: Array<{
    coin: string;
    walletBalance?: string;
    transferBalance?: string;
  }>;
};

function assertConfig(config: CexConfig) {
  if (!config.apiKey?.trim() || !config.apiSecret?.trim()) {
    throw new AssetProviderError("Bybit API key and secret are required.", "BAD_CONFIG");
  }
}

function classifyBybitCode(code: number) {
  if ([10003, 10004, 10005, 10007, 10010].includes(code)) {
    return "AUTH_FAILED";
  }

  if ([10006, 10429].includes(code)) {
    return "RATE_LIMITED";
  }

  if (code >= 50000) {
    return "PROVIDER_DOWN";
  }

  return "UNKNOWN";
}

function sign(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

async function bybitFetch<T>(
  config: CexConfig,
  endpoint: string,
  query: URLSearchParams,
  signed = false,
  options: { timeoutMs?: number } = {}
) {
  assertConfig(config);

  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const queryString = query.toString();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (signed) {
    const timestamp = String(Date.now());
    headers["X-BAPI-API-KEY"] = config.apiKey;
    headers["X-BAPI-TIMESTAMP"] = timestamp;
    headers["X-BAPI-RECV-WINDOW"] = RECV_WINDOW;
    headers["X-BAPI-SIGN"] = sign(
      config.apiSecret,
      `${timestamp}${config.apiKey}${RECV_WINDOW}${queryString}`
    );
  }

  const payload = await fetchJson<BybitResponse<T>>(
    PROVIDER,
    `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`,
    { method: "GET", headers, timeoutMs: options.timeoutMs }
  );

  if (payload.retCode !== 0) {
    throw new AssetProviderError(
      payload.retMsg || `Bybit request failed with code ${payload.retCode}.`,
      classifyBybitCode(payload.retCode)
    );
  }

  return payload.result;
}

async function getUsdPriceMap(config: CexConfig) {
  const data = await bybitFetch<BybitTickerResult>(
    config,
    TICKERS_ENDPOINT,
    new URLSearchParams({ category: "spot" }),
    false,
    { timeoutMs: CORE_TIMEOUT_MS }
  );
  const prices = createStablePriceMap();

  for (const ticker of data.list ?? []) {
    if (!ticker.symbol.endsWith("USDT")) {
      continue;
    }

    const assetSymbol = ticker.symbol.slice(0, -4);
    const price = toNumber(ticker.lastPrice);
    if (assetSymbol && price > 0) {
      prices.set(assetSymbol, price);
    }
  }

  return prices;
}

async function getWalletBalance(config: CexConfig, accountType: string) {
  try {
    return await bybitFetch<BybitWalletResult>(
      config,
      WALLET_BALANCE_ENDPOINT,
      new URLSearchParams({ accountType }),
      true,
      { timeoutMs: CORE_TIMEOUT_MS }
    );
  } catch (error) {
    if (error instanceof AssetProviderError && error.code === "UNKNOWN") {
      return { list: [] };
    }
    throw error;
  }
}

async function testAnyWalletBalance(config: CexConfig) {
  let lastError: unknown = null;

  for (const accountType of ACCOUNT_TYPES) {
    try {
      await bybitFetch<BybitWalletResult>(
        config,
        WALLET_BALANCE_ENDPOINT,
        new URLSearchParams({ accountType }),
        true,
        { timeoutMs: CORE_TIMEOUT_MS }
      );
      return;
    } catch (error) {
      if (error instanceof AssetProviderError && error.code !== "UNKNOWN") {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AssetProviderError("Bybit wallet balance request failed.", "UNKNOWN");
}

async function getFundingBalance(config: CexConfig) {
  try {
    return await bybitFetch<BybitCoinBalanceResult>(
      config,
      ACCOUNT_COINS_BALANCE_ENDPOINT,
      new URLSearchParams({ accountType: "FUND" }),
      true,
      { timeoutMs: CORE_TIMEOUT_MS }
    );
  } catch (error) {
    if (error instanceof AssetProviderError && error.code === "UNKNOWN") {
      return { accountType: "FUND", balance: [] };
    }
    throw error;
  }
}

function normalizeBalances(
  results: BybitWalletResult[],
  funding: BybitCoinBalanceResult,
  prices: Map<string, number>
) {
  const grouped = new Map<string, Array<Record<string, string | undefined>>>();

  for (const account of results.flatMap((result) => result.list ?? [])) {
    for (const coin of account.coin ?? []) {
      const amount = toNumber(coin.walletBalance);
      if (amount <= 0) {
        continue;
      }

      const assetSymbol = coin.coin.toUpperCase();
      grouped.set(assetSymbol, [
        ...(grouped.get(assetSymbol) ?? []),
        {
          accountType: account.accountType,
          walletBalance: coin.walletBalance,
          transferBalance: coin.transferBalance,
          locked: coin.locked,
          usdValue: coin.usdValue,
        },
      ]);
    }
  }

  for (const coin of funding.balance ?? []) {
    const amount = toNumber(coin.walletBalance);
    if (amount <= 0) {
      continue;
    }

    const assetSymbol = coin.coin.toUpperCase();
    grouped.set(assetSymbol, [
      ...(grouped.get(assetSymbol) ?? []),
      {
        accountType: funding.accountType || "FUND",
        walletBalance: coin.walletBalance,
        transferBalance: coin.transferBalance,
      },
    ]);
  }

  return Array.from(grouped.entries()).map<NormalizedAssetBalance>(([assetSymbol, records]) => {
    const amount = records.reduce((sum, record) => sum + toNumber(record.walletBalance), 0);
    const price = prices.get(assetSymbol) ?? 0;
    const providerValue = records.reduce((sum, record) => sum + toNumber(record.usdValue), 0);

    return {
      assetSymbol,
      assetName: assetSymbol,
      amount,
      valueUsd: providerValue || amount * price,
      category: "SPOT",
      rawData: {
        provider: "BYBIT",
        accounts: records,
        priceUsd: price,
      },
    };
  });
}

async function getBalances(config: CexConfig) {
  const [wallets, funding, prices] = await Promise.all([
    Promise.all(ACCOUNT_TYPES.map((accountType) => getWalletBalance(config, accountType))),
    getFundingBalance(config),
    getUsdPriceMap(config),
  ]);

  return normalizeBalances(wallets, funding, prices);
}

export const bybitAdapter: CexAdapter = {
  provider: "BYBIT",
  async testConnection(config) {
    await testAnyWalletBalance(config);
  },
  getBalances,
};
