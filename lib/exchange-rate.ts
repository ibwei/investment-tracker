const EXCHANGE_RATE_API_URL = "https://api.frankfurter.dev/v1/latest";

export async function getUsdExchangeRate(target: string) {
  const normalizedTarget = String(target || "").trim().toUpperCase();
  if (!normalizedTarget) {
    throw new Error("Exchange rate target is required.");
  }

  const upstreamUrl = `${EXCHANGE_RATE_API_URL}?base=USD&symbols=${encodeURIComponent(normalizedTarget)}`;
  const response = await fetch(upstreamUrl, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw Object.assign(new Error("Failed to fetch exchange rate."), {
      upstreamStatus: response.status
    });
  }

  const payload = await response.json();
  const rate = Number(payload?.rates?.[normalizedTarget]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Exchange rate is unavailable.");
  }

  return {
    base: "USD",
    target: normalizedTarget,
    rate,
    date: payload?.date ?? null,
    source: "Frankfurter"
  };
}
