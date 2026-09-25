import { measure } from "@/lib/performance";
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
  transient: boolean;

  constructor(
    message: string,
    code: AssetProviderErrorCode = "UNKNOWN",
    status?: number,
    transient = false
  ) {
    super(message);
    this.name = "AssetProviderError";
    this.code = code;
    this.status = status;
    this.transient = transient;
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

const CEX_TIMEOUT_MS = 20_000;
const ONCHAIN_TIMEOUT_MS = 55_000;
const TRANSIENT_RETRY_DELAY_MS = 2_000;
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524]);

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

function createTimeoutSignal(timeoutMs: number) {
  return AbortSignal.timeout(timeoutMs);
}

function timeoutFor(payload?: AssetSyncRequest) {
  return payload?.type === "ONCHAIN" ? ONCHAIN_TIMEOUT_MS : CEX_TIMEOUT_MS;
}

function isTransientStatus(status: number) {
  return TRANSIENT_HTTP_STATUSES.has(status);
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestService(path: string, init: RequestInit, timeoutMs: number) {
  return measure("provider", () =>
    fetch(`${getServiceBaseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: createTimeoutSignal(timeoutMs),
    })
  );
}

function toRequestError(error: unknown) {
  return new AssetProviderError(
    `CEX DEX service request failed: ${error instanceof Error ? error.message : "Unknown error."}`,
    "PROVIDER_DOWN",
    undefined,
    true
  );
}

async function readErrorResponse(response: Response) {
  const body = await response.json().catch(() => null);
  const transient = isTransientStatus(response.status);
  throw new AssetProviderError(
    body?.error ?? `CEX DEX service request failed with HTTP ${response.status}.`,
    transient ? "PROVIDER_DOWN" : (body?.code ?? "UNKNOWN"),
    response.status,
    transient
  );
}

async function withTransientRetry<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof AssetProviderError) || !error.transient) {
      throw error;
    }
    await pause(TRANSIENT_RETRY_DELAY_MS);
    return run();
  }
}

async function postToService<T>(path: string, payload: AssetSyncRequest): Promise<T> {
  const timeoutMs = timeoutFor(payload);

  return withTransientRetry(async () => {
    const response = await requestService(
      path,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...getServiceAuthHeaders(),
        },
        body: JSON.stringify(payload),
      },
      timeoutMs
    ).catch((error) => {
      throw toRequestError(error);
    });

    if (!response.ok) {
      await readErrorResponse(response);
    }

    return (await response.json().catch(() => null)) as T;
  });
}

export async function fetchSourceAssetsFromCexDexService(payload: AssetSyncRequest) {
  return postToService<AssetSyncResponse>("/api/assets/sync", payload);
}

export async function testSourceConnectionWithCexDexService(payload: AssetSyncRequest) {
  return postToService<{ ok: true }>("/api/assets/test", payload);
}

export async function proxyCexDexServiceGet(path: string) {
  return withTransientRetry(async () => {
    const response = await requestService(
      path,
      {
        headers: {
          accept: "application/json",
          ...getServiceAuthHeaders(),
        },
      },
      CEX_TIMEOUT_MS
    ).catch((error) => {
      throw toRequestError(error);
    });

    if (!response.ok) {
      await readErrorResponse(response);
    }

    return response.json().catch(() => null);
  });
}

export type { AssetProviderType, AssetSyncRequest };
