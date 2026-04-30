import type { NormalizedAssetBalance, NormalizedAssetPosition } from "@/lib/assets/types";

type AssetProviderType = "CEX" | "ONCHAIN";

export type AssetProviderErrorCode =
  | "AUTH_FAILED"
  | "ACCESS_DENIED"
  | "RATE_LIMITED"
  | "PROVIDER_DOWN"
  | "BAD_CONFIG"
  | "UNKNOWN";

export class AssetProviderError extends Error {
  code: AssetProviderErrorCode;
  status?: number;

  constructor(message: string, code: AssetProviderErrorCode = "UNKNOWN", status?: number) {
    super(message);
    this.name = "AssetProviderError";
    this.code = code;
    this.status = status;
  }
}

export type CexConfig = {
  apiKey: string;
  apiSecret: string;
  passphrase?: string | null;
  apiKeyVersion?: string | null;
  baseUrl?: string | null;
};

export type OnchainConfig = {
  address: string;
  provider: string;
  baseUrl?: string | null;
};

type AssetSyncRequest =
  | {
      type: "CEX";
      provider: string;
      config: CexConfig;
    }
  | {
      type: "ONCHAIN";
      provider: string;
      config: OnchainConfig;
    };

type AssetSyncResponse = {
  balances: NormalizedAssetBalance[];
  positions: NormalizedAssetPosition[];
};

const SERVICE_TIMEOUT_MS = 20_000;

function getServiceBaseUrl() {
  const configured = process.env.CEX_DEX_SERVICE_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    return configured.endsWith("/api") ? configured.slice(0, -4) : configured;
  }

  return "https://api-cex-dex-tracker.berrylabs.online";
}

function getServiceAuthHeaders() {
  const token =
    process.env.CEX_DEX_SERVICE_TOKEN?.trim() ||
    process.env.ASSET_SERVICE_TOKEN?.trim() ||
    "";

  return token
    ? {
        authorization: `Bearer ${token}`,
      }
    : {};
}

function createTimeoutSignal() {
  return AbortSignal.timeout(SERVICE_TIMEOUT_MS);
}

async function postToService<T>(path: string, payload: AssetSyncRequest): Promise<T> {
  const response = await fetch(`${getServiceBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...getServiceAuthHeaders(),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: createTimeoutSignal(),
  }).catch((error) => {
    throw new AssetProviderError(
      `CEX DEX service request failed: ${error instanceof Error ? error.message : "Unknown error."}`,
      "PROVIDER_DOWN"
    );
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AssetProviderError(
      body?.error ?? `CEX DEX service request failed with HTTP ${response.status}.`,
      body?.code ?? "UNKNOWN",
      response.status
    );
  }

  return body as T;
}

export async function fetchSourceAssetsFromCexDexService(payload: AssetSyncRequest) {
  return postToService<AssetSyncResponse>("/api/assets/sync", payload);
}

export async function testSourceConnectionWithCexDexService(payload: AssetSyncRequest) {
  return postToService<{ ok: true }>("/api/assets/test", payload);
}

export async function proxyCexDexServiceGet(path: string) {
  const response = await fetch(`${getServiceBaseUrl()}${path}`, {
    headers: {
      accept: "application/json",
      ...getServiceAuthHeaders(),
    },
    cache: "no-store",
    signal: createTimeoutSignal(),
  }).catch((error) => {
    throw new AssetProviderError(
      `CEX DEX service request failed: ${error instanceof Error ? error.message : "Unknown error."}`,
      "PROVIDER_DOWN"
    );
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AssetProviderError(
      body?.error ?? `CEX DEX service request failed with HTTP ${response.status}.`,
      body?.code ?? "UNKNOWN",
      response.status
    );
  }

  return body;
}

export type { AssetProviderType, AssetSyncRequest };
