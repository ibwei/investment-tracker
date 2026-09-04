import { NextResponse } from "next/server";
import { getUsdExchangeRate } from "@/lib/exchange-rate";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") || "USD";
  const target = searchParams.get("target") || "CNY";

  if (base !== "USD") {
    return NextResponse.json(
      { error: "Only USD base is currently supported." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await getUsdExchangeRate(target));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch exchange rate.",
        source: "Frankfurter",
        upstreamStatus: (error as { upstreamStatus?: number })?.upstreamStatus,
        details: error instanceof Error ? error.message : "Unknown upstream error.",
      },
      { status: 502 }
    );
  }
}
