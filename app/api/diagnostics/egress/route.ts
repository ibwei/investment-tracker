import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGETS: Record<
  string,
  { label: string; url: string; method?: "GET" | "HEAD" }
> = {
  kucoin: {
    label: "KuCoin",
    url: "https://api.kucoin.com/api/v1/market/allTickers",
  },
  binance: {
    label: "Binance",
    url: "https://api.binance.com/api/v3/time",
  },
  okx: {
    label: "OKX",
    url: "https://www.okx.com/api/v5/public/time",
  },
  bybit: {
    label: "Bybit",
    url: "https://api.bybit.com/v5/market/time",
  },
  bitget: {
    label: "Bitget",
    url: "https://api.bitget.com/api/v2/spot/market/tickers",
  },
  gate: {
    label: "Gate",
    url: "https://api.gateio.ws/api/v4/spot/time",
  },
  htx: {
    label: "HTX",
    url: "https://api.huobi.pro/v1/common/timestamp",
  },
};

function getTargetList(raw: string | null) {
  if (!raw) {
    return Object.keys(TARGETS);
  }

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item && TARGETS[item]);
}

async function fetchWithTimeout(url: string, method: "GET" | "HEAD" = "GET") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method,
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: null,
      statusText: error?.message ?? "Request failed.",
      durationMs: Date.now() - startedAt,
      error: error?.cause?.code ?? error?.code ?? "UNKNOWN",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getEgressIp() {
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return payload?.ip ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targets = getTargetList(searchParams.get("targets"));
  const includeIp = searchParams.get("includeIp") === "true";

  const results = await Promise.all(
    targets.map(async (key) => {
      const target = TARGETS[key];
      const result = await fetchWithTimeout(target.url, target.method ?? "GET");
      return {
        key,
        label: target.label,
        url: target.url,
        ...result,
      };
    })
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    includeIp,
    ip: includeIp ? await getEgressIp() : null,
    results,
  });
}
