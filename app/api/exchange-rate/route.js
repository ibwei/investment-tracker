import { NextResponse } from "next/server";

const API_URL = "https://cdn.moneyconvert.net/api/latest.json";

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
    const response = await fetch(API_URL, {
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch exchange rate." },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const rate = Number(payload?.rates?.[target]);

    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "Exchange rate is unavailable." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      base,
      target,
      rate,
      source: "MoneyConvert",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch exchange rate." },
      { status: 502 }
    );
  }
}
