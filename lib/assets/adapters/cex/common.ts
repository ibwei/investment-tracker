import { getDevelopmentProxyAgent } from "@/lib/assets/adapters/development-proxy";
import { AssetProviderError, type AssetProviderErrorCode } from "@/lib/assets/adapters/types";

export const STABLE_USD_ASSETS = new Set([
  "USD",
  "USDT",
  "USDC",
  "DAI",
  "FDUSD",
  "TUSD",
  "USDD",
  "PYUSD",
]);

export function sanitizeBaseUrl(value: string | null | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/\/+$/, "");
}

export function toNumber(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function classifyHttpError(status: number): AssetProviderErrorCode {
  if (status === 401 || status === 403) {
    return "AUTH_FAILED";
  }

  if (status === 418 || status === 429) {
    return "RATE_LIMITED";
  }

  if (status >= 500) {
    return "PROVIDER_DOWN";
  }

  return "UNKNOWN";
}

export function toProviderNetworkError(provider: string, error: unknown) {
  if (error instanceof AssetProviderError) {
    return error;
  }

  const cause = (error as { cause?: { code?: string; host?: string; port?: number } })?.cause;
  const message = error instanceof Error ? error.message : "Unknown network error.";
  const details = [
    cause?.code,
    cause?.host ? `${cause.host}${cause.port ? `:${cause.port}` : ""}` : "",
  ].filter(Boolean);

  return new AssetProviderError(
    `${provider} network request failed: ${message}${details.length ? ` (${details.join(" ")})` : ""}`,
    "PROVIDER_DOWN"
  );
}

type FetchJsonInit = RequestInit & {
  timeoutMs?: number;
};

async function readProviderErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return "";
  }

  try {
    const payload = JSON.parse(text) as {
      message?: string;
      msg?: string;
      error?: string;
      error_message?: string;
    };
    return payload.message || payload.msg || payload.error_message || payload.error || text.slice(0, 240);
  } catch {
    return text.slice(0, 240);
  }
}

export async function fetchJson<T>(provider: string, url: string, init?: FetchJsonInit) {
  const { timeoutMs, signal, ...requestInit } = init ?? {};
  const controller = timeoutMs ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(new Error(`${provider} request timed out after ${timeoutMs}ms.`)), timeoutMs)
    : null;

  const response = await fetch(url, {
    ...requestInit,
    cache: "no-store",
    signal: signal ?? controller?.signal,
    dispatcher: getDevelopmentProxyAgent(),
  } as RequestInit & { dispatcher?: ReturnType<typeof getDevelopmentProxyAgent> }).catch((error) => {
    throw toProviderNetworkError(provider, error);
  }).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });

  if (!response.ok) {
    const providerMessage = await readProviderErrorMessage(response);
    throw new AssetProviderError(
      `${provider} request failed with HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : ""}.`,
      classifyHttpError(response.status),
      response.status
    );
  }

  return (await response.json()) as T;
}

export function createStablePriceMap() {
  const prices = new Map<string, number>();

  for (const symbol of STABLE_USD_ASSETS) {
    prices.set(symbol, 1);
  }

  return prices;
}
