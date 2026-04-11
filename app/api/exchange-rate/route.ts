import { NextResponse } from "next/server";

const API_URL = "https://api.frankfurter.dev/v1/latest";

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
    const upstreamUrl = `${API_URL}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(target)}`;
    const response = await fetch(upstreamUrl, {
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        {
          error: "Failed to fetch exchange rate.",
          source: "Frankfurter",
          upstreamStatus: response.status,
          details: details.slice(0, 200),
        },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const rate = Number(payload?.rates?.[target]);

    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        {
          error: "Exchange rate is unavailable.",
          source: "Frankfurter",
          details: "Upstream response did not include a valid target rate.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      base,
      target,
      rate,
      date: payload?.date ?? null,
      source: "Frankfurter",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch exchange rate.",
        source: "Frankfurter",
        details: error instanceof Error ? error.message : "Unknown upstream error.",
      },
      { status: 502 }
    );
  }
}
