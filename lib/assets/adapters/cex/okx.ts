import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance } from "@/lib/assets/types";
import { AssetProviderError, type CexAdapter, type CexConfig } from "@/lib/assets/adapters/types";
import { createStablePriceMap, fetchJson, sanitizeBaseUrl, toNumber } from "./common";

const PROVIDER = "OKX";
const DEFAULT_BASE_URL = "https://www.okx.com";
const TRADING_BALANCE_ENDPOINT = "/api/v5/account/balance";
const FUNDING_BALANCE_ENDPOINT = "/api/v5/asset/balances";
const SAVINGS_BALANCE_ENDPOINT = "/api/v5/finance/savings/balance";
const STAKING_DEFI_ACTIVE_ORDERS_ENDPOINT = "/api/v5/finance/staking-defi/orders-active";
const ASSET_VALUATION_ENDPOINT = "/api/v5/asset/asset-valuation?ccy=USD";
const TICKERS_ENDPOINT = "/api/v5/market/tickers?instType=SPOT";
const CORE_TIMEOUT_MS = 8000;
const EARN_TIMEOUT_MS = 12000;
const OPTIONAL_TIMEOUT_MS = 2500;

// Official docs:
// https://www.okx.com/docs-v5/en/#trading-account-rest-api-get-balance
// https://www.okx.com/docs-v5/en/#funding-account-rest-api-get-balance
// https://www.okx.com/docs-v5/en/#financial-product-simple-earn-flexible-get-saving-balance
// https://www.okx.com/docs-v5/en/#financial-product-on-chain-earn-get-active-orders
// https://www.okx.com/docs-v5/en/#funding-account-rest-api-get-account-asset-valuation
// https://www.okx.com/docs-v5/en/#overview-rest-authentication

type OkxResponse<T> = {
  code: string;
  msg: string;
  data: T;
};

type OkxTradingBalanceResponse = Array<{
  totalEq?: string;
  details?: Array<{
    ccy: string;
    cashBal?: string;
    eq?: string;
    eqUsd?: string;
    availBal?: string;
    frozenBal?: string;
  }>;
}>;

type OkxFundingBalance = {
  ccy: string;
  bal?: string;
  frozenBal?: string;
  availBal?: string;
};

type OkxSavingBalance = {
  ccy: string;
  amt?: string;
  earnings?: string;
  loanAmt?: string;
  pendingAmt?: string;
  rate?: string;
};

type OkxStakingDefiOrder = {
  ordId: string;
  ccy: string;
  productId?: string;
  state?: string;
  protocol?: string;
  protocolType?: string;
  term?: string;
  apy?: string;
  investData?: Array<{
    ccy: string;
    amt: string;
  }>;
  earningData?: Array<{
    ccy: string;
    earningType?: string;
    earnings?: string;
  }>;
};

type OkxAssetValuation = Array<{
  totalBal?: string;
  ts?: string;
  details?: {
    funding?: string;
    trading?: string;
    classic?: string;
    earn?: string;
  };
}>;

type OkxTicker = {
  instId: string;
  last: string;
};

type OkxBalanceBucket = {
  assetSymbol: string;
  category: "SPOT" | "EARN";
  amount: number;
  valueUsd: number;
  rawItems: unknown[];
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

async function okxFetch<T>(
  config: CexConfig,
  endpoint: string,
  signed = false,
  options: { timeoutMs?: number } = {}
) {
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
    timeoutMs: options.timeoutMs,
  });

  if (payload.code !== "0") {
    throw new AssetProviderError(
      payload.msg || `OKX request failed with code ${payload.code}.`,
      classifyOkxCode(payload.code)
    );
  }

  return payload.data;
}

async function okxOptionalFetch<T>(config: CexConfig, endpoint: string, fallback: T) {
  try {
    return await okxFetch<T>(config, endpoint, true, { timeoutMs: OPTIONAL_TIMEOUT_MS });
  } catch (error) {
    if (error instanceof AssetProviderError && error.code === "AUTH_FAILED") {
      throw error;
    }

    return fallback;
  }
}

async function getUsdPriceMap(config: CexConfig, timeoutMs = CORE_TIMEOUT_MS) {
  const tickers = await okxFetch<OkxTicker[]>(config, TICKERS_ENDPOINT, false, { timeoutMs });
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

function addBucket(
  buckets: Map<string, OkxBalanceBucket>,
  assetSymbol: string,
  category: OkxBalanceBucket["category"],
  amount: number,
  valueUsd: number,
  rawItem: unknown
) {
  if (!assetSymbol || amount <= 0) {
    return;
  }

  const key = `${assetSymbol}:${category}`;
  const existing = buckets.get(key);

  if (existing) {
    existing.amount += amount;
    existing.valueUsd += valueUsd;
    existing.rawItems.push(rawItem);
    return;
  }

  buckets.set(key, {
    assetSymbol,
    category,
    amount,
    valueUsd,
    rawItems: [rawItem],
  });
}

function addTradingBalances(
  buckets: Map<string, OkxBalanceBucket>,
  data: OkxTradingBalanceResponse,
  prices: Map<string, number>
) {
  for (const detail of data.flatMap((item) => item.details ?? [])) {
    const assetSymbol = detail.ccy.toUpperCase();
    const amount = toNumber(detail.eq || detail.cashBal);
    const price = prices.get(assetSymbol) ?? 0;
    const valueUsd = toNumber(detail.eqUsd) || amount * price;

    addBucket(buckets, assetSymbol, "SPOT", amount, valueUsd, {
      account: "trading",
      ...detail,
      priceUsd: price,
    });
  }
}

function addFundingBalances(
  buckets: Map<string, OkxBalanceBucket>,
  data: OkxFundingBalance[],
  prices: Map<string, number>
) {
  for (const balance of data) {
    const assetSymbol = balance.ccy.toUpperCase();
    const amount = toNumber(balance.bal);
    const price = prices.get(assetSymbol) ?? 0;

    addBucket(buckets, assetSymbol, "SPOT", amount, amount * price, {
      account: "funding",
      ...balance,
      priceUsd: price,
    });
  }
}

function addSavingBalances(
  buckets: Map<string, OkxBalanceBucket>,
  data: OkxSavingBalance[],
  prices: Map<string, number>
) {
  for (const balance of data) {
    const assetSymbol = balance.ccy.toUpperCase();
    const amount = toNumber(balance.amt);
    const price = prices.get(assetSymbol) ?? 0;

    addBucket(buckets, assetSymbol, "EARN", amount, amount * price, {
      account: "simple_earn_flexible",
      ...balance,
      priceUsd: price,
    });
  }
}

function addStakingDefiOrders(
  buckets: Map<string, OkxBalanceBucket>,
  data: OkxStakingDefiOrder[],
  prices: Map<string, number>
) {
  for (const order of data) {
    for (const investment of order.investData ?? []) {
      const assetSymbol = investment.ccy.toUpperCase();
      const amount = toNumber(investment.amt);
      const price = prices.get(assetSymbol) ?? 0;

      addBucket(buckets, assetSymbol, "EARN", amount, amount * price, {
        account: "staking_defi",
        ordId: order.ordId,
        productId: order.productId,
        state: order.state,
        protocol: order.protocol,
        protocolType: order.protocolType,
        term: order.term,
        apy: order.apy,
        investment,
        earningData: order.earningData,
        priceUsd: price,
      });
    }
  }
}

function addUnclassifiedEarnValuation(
  buckets: Map<string, OkxBalanceBucket>,
  valuation: OkxAssetValuation
) {
  const valuationDetails = valuation[0]?.details;
  const earnValueUsd = toNumber(valuationDetails?.earn);

  if (earnValueUsd <= 0) {
    return;
  }

  const classifiedEarnValueUsd = Array.from(buckets.values())
    .filter((bucket) => bucket.category === "EARN")
    .reduce((sum, bucket) => sum + bucket.valueUsd, 0);
  const deltaUsd = earnValueUsd - classifiedEarnValueUsd;

  if (deltaUsd <= 1) {
    return;
  }

  addBucket(buckets, "OKX_EARN_UNCLASSIFIED", "EARN", deltaUsd, deltaUsd, {
    account: "earn_unclassified_valuation",
    note: "OKX asset valuation reports Earn value that is not covered by per-currency Earn endpoints.",
    earnValueUsd,
    classifiedEarnValueUsd,
    deltaUsd,
    valuation: valuation[0] ?? null,
  });
}

function normalizeBalances({
  trading,
  funding,
  savings,
  stakingDefi,
  valuation,
  prices,
}: {
  trading: OkxTradingBalanceResponse;
  funding: OkxFundingBalance[];
  savings: OkxSavingBalance[];
  stakingDefi: OkxStakingDefiOrder[];
  valuation: OkxAssetValuation;
  prices: Map<string, number>;
}) {
  const buckets = new Map<string, OkxBalanceBucket>();

  addTradingBalances(buckets, trading, prices);
  addFundingBalances(buckets, funding, prices);
  addSavingBalances(buckets, savings, prices);
  addStakingDefiOrders(buckets, stakingDefi, prices);
  addUnclassifiedEarnValuation(buckets, valuation);

  return Array.from(buckets.values()).map<NormalizedAssetBalance>((bucket) => ({
    assetSymbol: bucket.assetSymbol,
    assetName: bucket.assetSymbol,
    amount: bucket.amount,
    valueUsd: bucket.valueUsd,
    category: bucket.category,
    rawData: {
      provider: "OKX",
      priceUsd: prices.get(bucket.assetSymbol) ?? null,
      valuation: valuation[0] ?? null,
      accounts: bucket.rawItems,
    },
  }));
}

async function getBalances(config: CexConfig) {
  const [trading, funding, savings, stakingDefi, valuation, prices] = await Promise.all([
    okxFetch<OkxTradingBalanceResponse>(config, TRADING_BALANCE_ENDPOINT, true, {
      timeoutMs: CORE_TIMEOUT_MS,
    }),
    okxFetch<OkxFundingBalance[]>(config, FUNDING_BALANCE_ENDPOINT, true, {
      timeoutMs: CORE_TIMEOUT_MS,
    }),
    okxFetch<OkxSavingBalance[]>(config, SAVINGS_BALANCE_ENDPOINT, true, {
      timeoutMs: EARN_TIMEOUT_MS,
    }),
    okxOptionalFetch<OkxStakingDefiOrder[]>(config, STAKING_DEFI_ACTIVE_ORDERS_ENDPOINT, []),
    okxOptionalFetch<OkxAssetValuation>(config, ASSET_VALUATION_ENDPOINT, []),
    getUsdPriceMap(config),
  ]);

  return normalizeBalances({
    trading,
    funding,
    savings,
    stakingDefi,
    valuation,
    prices,
  });
}

export const okxAdapter: CexAdapter = {
  provider: "OKX",
  async testConnection(config) {
    await okxFetch<OkxTradingBalanceResponse>(config, TRADING_BALANCE_ENDPOINT, true);
  },
  getBalances,
};
