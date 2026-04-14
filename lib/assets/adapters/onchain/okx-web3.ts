import { createHmac } from "node:crypto";
import type { NormalizedAssetBalance, NormalizedAssetPosition } from "@/lib/assets/types";
import { AssetProviderError, type OnchainAdapter, type OnchainConfig } from "@/lib/assets/adapters/types";
import { fetchJson, sanitizeBaseUrl, toNumber } from "@/lib/assets/adapters/cex/common";

const PROVIDER = "OKX_WEB3";
const DEFAULT_BASE_URL = "https://web3.okx.com";
const TOKEN_BALANCES_ENDPOINT = "/api/v6/dex/balance/all-token-balances-by-address";
const DEFI_PLATFORMS_ENDPOINT = "/api/v5/defi/user/asset/platform/list";
const REQUEST_TIMEOUT_MS = 12000;

const API_KEY_ENV = "OKX_WEB3_API_KEY";
const API_SECRET_ENV = "OKX_WEB3_API_SECRET";
const PASSPHRASE_ENV = "OKX_WEB3_PASSPHRASE";
const PROJECT_ID_ENV = "OKX_WEB3_PROJECT_ID";

const EVM_CHAIN_INDEXES = [
  "1",
  "56",
  "137",
  "42161",
  "10",
  "8453",
  "43114",
  "250",
  "324",
  "59144",
  "534352",
  "196",
  "81457",
];

const CHAIN_LABELS: Record<string, string> = {
  "0": "Bitcoin",
  "1": "Ethereum",
  "10": "Optimism",
  "56": "BNB Smart Chain",
  "137": "Polygon",
  "195": "Tron",
  "196": "X Layer",
  "250": "Fantom",
  "324": "zkSync Era",
  "501": "Solana",
  "607": "TON",
  "784": "Sui",
  "8453": "Base",
  "42161": "Arbitrum",
  "43114": "Avalanche",
  "59144": "Linea",
  "81457": "Blast",
  "534352": "Scroll",
};

// Official docs:
// https://web3.okx.com/onchainos/dev-docs/market/balance-total-token-balances
// https://web3.okx.com/build/docs/waas/defi-api-reference-personal-asset-platform-list

type OkxWeb3Response<T> = {
  code: string | number;
  msg: string;
  data: T;
};

type OkxTokenBalanceResponse = Array<{
  tokenAssets?: OkxTokenAsset[];
}>;

type OkxTokenAsset = {
  chainIndex?: string;
  tokenContractAddress?: string;
  address?: string;
  symbol?: string;
  balance?: string;
  rawBalance?: string;
  tokenPrice?: string;
  isRiskToken?: boolean;
};

type OkxDefiPlatformResponse = {
  walletIdPlatformList?: Array<{
    platformList?: OkxDefiPlatform[];
  }>;
};

type OkxDefiPlatform = {
  platformName?: string;
  analysisPlatformId?: string;
  platformLogo?: string;
  currencyAmount?: string;
  isSupportInvest?: string;
};

type BalanceBucket = {
  assetSymbol: string;
  amount: number;
  valueUsd: number;
  category: "SPOT" | "DETAIL";
  rawItems: unknown[];
};

type OkxWeb3Env = {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  projectId?: string;
};

function getEnv() {
  const apiKey = process.env[API_KEY_ENV]?.trim();
  const apiSecret = process.env[API_SECRET_ENV]?.trim();
  const passphrase = process.env[PASSPHRASE_ENV]?.trim();
  const projectId = process.env[PROJECT_ID_ENV]?.trim();

  if (!apiKey || !apiSecret || !passphrase) {
    throw new AssetProviderError(
      `${API_KEY_ENV}, ${API_SECRET_ENV}, and ${PASSPHRASE_ENV} are required for OKX Web3 on-chain sync.`,
      "BAD_CONFIG"
    );
  }

  return { apiKey, apiSecret, passphrase, projectId };
}

function assertConfig(config: OnchainConfig) {
  if (!config.address?.trim()) {
    throw new AssetProviderError("Wallet address is required.", "BAD_CONFIG");
  }
}

function normalizeOkxCode(code: string | number | null | undefined) {
  return String(code ?? "");
}

function classifyOkxCode(code: string | number | null | undefined) {
  const normalizedCode = normalizeOkxCode(code);

  if (["50113", "50114", "50115", "50116", "50117"].includes(normalizedCode)) {
    return "AUTH_FAILED";
  }

  if (normalizedCode === "50011") {
    return "RATE_LIMITED";
  }

  if (normalizedCode.startsWith("5")) {
    return "PROVIDER_DOWN";
  }

  return "UNKNOWN";
}

function sign(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64");
}

function isEvmAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isSuiAddress(address: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

function isTronAddress(address: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

function isBitcoinAddress(address: string) {
  return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(address);
}

function isTonAddress(address: string) {
  return /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(address);
}

function isLikelySolanaAddress(address: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function inferChainIndexes(provider: string, address: string) {
  switch (provider.toUpperCase()) {
    case "OKX_EVM":
    case "EVM":
      if (!isEvmAddress(address)) {
        throw new AssetProviderError("EVM wallet address must be a 0x address.", "BAD_CONFIG");
      }
      return EVM_CHAIN_INDEXES;
    case "OKX_SOLANA":
    case "SOLANA":
      return ["501"];
    case "OKX_SUI":
    case "SUI":
      return ["784"];
    case "OKX_TRON":
    case "TRON":
      return ["195"];
    case "OKX_BITCOIN":
    case "BITCOIN":
    case "BTC":
      return ["0"];
    case "OKX_TON":
    case "TON":
      return ["607"];
    default:
      if (isEvmAddress(address)) return EVM_CHAIN_INDEXES;
      if (isSuiAddress(address)) return ["784"];
      if (isTronAddress(address)) return ["195"];
      if (isBitcoinAddress(address)) return ["0"];
      if (isTonAddress(address)) return ["607"];
      if (isLikelySolanaAddress(address)) return ["501"];
      throw new AssetProviderError("Unsupported wallet address format for OKX Web3 sync.", "BAD_CONFIG");
  }
}

async function okxWeb3Fetch<T>(
  config: OnchainConfig,
  endpoint: string,
  options: { method?: "GET" | "POST"; query?: URLSearchParams; body?: unknown } = {}
) {
  assertConfig(config);

  const env = getEnv();
  const method = options.method ?? "GET";
  const baseUrl = sanitizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL);
  const query = options.query?.size ? `?${options.query.toString()}` : "";
  const requestPath = `${endpoint}${query}`;
  const body = options.body ? JSON.stringify(options.body) : "";
  const timestamp = new Date().toISOString();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": env.apiKey,
    "OK-ACCESS-SIGN": sign(env.apiSecret, `${timestamp}${method}${requestPath}${body}`),
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": env.passphrase,
  };

  if (env.projectId) {
    headers["OK-ACCESS-PROJECT"] = env.projectId;
  }

  const payload = await fetchJson<OkxWeb3Response<T>>(PROVIDER, `${baseUrl}${requestPath}`, {
    method,
    headers,
    body: body || undefined,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  const code = normalizeOkxCode(payload.code);

  if (code !== "0") {
    throw new AssetProviderError(
      payload.msg || `OKX Web3 request failed with code ${code}.`,
      classifyOkxCode(code)
    );
  }

  return payload.data;
}

function addTokenAsset(buckets: Map<string, BalanceBucket>, token: OkxTokenAsset) {
  const assetSymbol = (token.symbol || token.tokenContractAddress || "UNKNOWN").toUpperCase();
  const amount = toNumber(token.balance);
  const valueUsd = amount * toNumber(token.tokenPrice);
  const category = isLikelyDefiDetailToken(assetSymbol) ? "DETAIL" : "SPOT";

  if (amount <= 0 && valueUsd <= 0) {
    return;
  }

  const rawItem = {
    provider: PROVIDER,
    chainIndex: token.chainIndex,
    chain: token.chainIndex ? CHAIN_LABELS[token.chainIndex] ?? token.chainIndex : undefined,
    tokenContractAddress: token.tokenContractAddress,
    address: token.address,
    balance: token.balance,
    tokenPrice: token.tokenPrice,
    valueUsd,
    isRiskToken: token.isRiskToken,
  };
  const existing = buckets.get(assetSymbol);

  if (existing) {
    existing.amount += amount;
    existing.valueUsd += valueUsd;
    existing.rawItems.push(rawItem);
    return;
  }

  buckets.set(assetSymbol, {
    assetSymbol,
    amount,
    valueUsd,
    category,
    rawItems: [rawItem],
  });
}

function isLikelyDefiDetailToken(symbol: string) {
  const normalized = symbol.toUpperCase();

  return (
    normalized.startsWith("PT-") ||
    normalized.startsWith("YT-") ||
    normalized.startsWith("SY-") ||
    normalized === "SPENDLE" ||
    normalized.startsWith("LP-") ||
    normalized.endsWith("-LP") ||
    /^STK[A-Z0-9]{2,}/.test(normalized)
  );
}

function normalizeBalances(response: OkxTokenBalanceResponse) {
  const buckets = new Map<string, BalanceBucket>();

  for (const token of response.flatMap((item) => item.tokenAssets ?? [])) {
    addTokenAsset(buckets, token);
  }

  return Array.from(buckets.values()).map<NormalizedAssetBalance>((bucket) => ({
    assetSymbol: bucket.assetSymbol,
    assetName: bucket.assetSymbol,
    amount: bucket.amount,
    valueUsd: bucket.valueUsd,
    category: bucket.category,
    rawData: {
      provider: PROVIDER,
      countedInTotal: bucket.category !== "DETAIL",
      chains: bucket.rawItems,
    },
  }));
}

function normalizeTokenBalanceGroups(response: OkxTokenBalanceResponse | { tokenAssets?: OkxTokenAsset[] }) {
  return Array.isArray(response) ? response : [response];
}

function normalizeDefiPlatformGroups(response: OkxDefiPlatformResponse | OkxDefiPlatformResponse[]) {
  return Array.isArray(response) ? response : [response];
}

function normalizePositions(response: OkxDefiPlatformResponse | OkxDefiPlatformResponse[], chains: string[]) {
  const platforms = normalizeDefiPlatformGroups(response).flatMap((item) =>
    (item.walletIdPlatformList ?? []).flatMap((wallet) => wallet.platformList ?? [])
  );

  return platforms
    .map<NormalizedAssetPosition | null>((platform) => {
      const netValueUsd = toNumber(platform.currencyAmount);
      if (netValueUsd <= 0) {
        return null;
      }

      return {
        provider: PROVIDER,
        chain: chains.length === 1 ? CHAIN_LABELS[chains[0]] ?? chains[0] : "MULTI",
        protocolId: platform.analysisPlatformId || platform.platformName || "unknown",
        protocolName: platform.platformName || platform.analysisPlatformId || "OKX DeFi",
        positionType: "DEFI",
        assetValueUsd: netValueUsd,
        debtValueUsd: 0,
        rewardValueUsd: 0,
        netValueUsd,
        rawData: {
          provider: PROVIDER,
          chains,
          platform,
        },
      };
    })
    .filter((position): position is NormalizedAssetPosition => Boolean(position));
}

function chainIndexesForConfig(config: OnchainConfig) {
  return inferChainIndexes(config.provider, config.address.trim());
}

async function getTokenBalances(config: OnchainConfig) {
  const chains = chainIndexesForConfig(config);
  return okxWeb3Fetch<OkxTokenBalanceResponse>(config, TOKEN_BALANCES_ENDPOINT, {
    query: new URLSearchParams({
      address: config.address.trim(),
      chains: chains.join(","),
      excludeRiskToken: "0",
    }),
  });
}

async function getDefiPlatforms(config: OnchainConfig) {
  const chains = chainIndexesForConfig(config);
  return okxWeb3Fetch<OkxDefiPlatformResponse>(config, DEFI_PLATFORMS_ENDPOINT, {
    method: "POST",
    body: {
      walletAddressList: chains.map((chainId) => ({
        chainId,
        walletAddress: config.address.trim(),
      })),
    },
  });
}

export const okxWeb3Adapter: OnchainAdapter = {
  provider: PROVIDER,
  aliases: [
    "AUTO",
    "OKX",
    "OKX_EVM",
    "EVM",
    "OKX_SOLANA",
    "SOLANA",
    "OKX_SUI",
    "SUI",
    "OKX_TRON",
    "TRON",
    "OKX_BITCOIN",
    "BITCOIN",
    "BTC",
    "OKX_TON",
    "TON",
  ],
  async testConnection(config) {
    await getTokenBalances(config);
  },
  async getBalances(config) {
    return normalizeBalances(normalizeTokenBalanceGroups(await getTokenBalances(config)));
  },
  async getPositions(config) {
    const chains = chainIndexesForConfig(config);
    return normalizePositions(await getDefiPlatforms(config), chains);
  },
};
