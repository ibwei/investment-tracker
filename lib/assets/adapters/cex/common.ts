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

export async function fetchJson<T>(provider: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    dispatcher: getDevelopmentProxyAgent(),
  } as RequestInit & { dispatcher?: ReturnType<typeof getDevelopmentProxyAgent> }).catch((error) => {
    throw toProviderNetworkError(provider, error);
  });

  if (!response.ok) {
    throw new AssetProviderError(
      `${provider} request failed with HTTP ${response.status}.`,
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
