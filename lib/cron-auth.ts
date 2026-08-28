import { createHash, timingSafeEqual } from "node:crypto";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}

function secretsMatch(provided: string, expected: string) {
  return timingSafeEqual(hashSecret(provided), hashSecret(expected));
}

export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  return [getBearerToken(request), request.headers.get("x-cron-secret") ?? ""].some(
    (provided) => secretsMatch(provided, secret)
  );
}
