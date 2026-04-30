import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "earn_compass_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const DEVELOPMENT_AUTH_SECRET = "earn-compass-dev-secret";

function createAuthError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim();

  if (process.env.NODE_ENV === "production" && !secret) {
    throw createAuthError("AUTH_SECRET is required in production.");
  }

  return secret || DEVELOPMENT_AUTH_SECRET;
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));

  return left.length === right.length && timingSafeEqual(left, right);
}

function getAllowedRequestOrigins(request) {
  const origins = new Set([new URL(request.url).origin]);

  for (const value of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!value) {
      continue;
    }

    try {
      origins.add(new URL(value).origin);
    } catch {
      throw createAuthError("Configured app URL is invalid.");
    }
  }

  return origins;
}

export function assertSameOriginRequest(request) {
  const method = String(request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    if (!getAllowedRequestOrigins(request).has(origin)) {
      throw createAuthError("Cross-origin request is not allowed.", 403);
    }
    return;
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw createAuthError("Cross-origin request is not allowed.", 403);
  }
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");

  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");

  return (
    derived.length === stored.length &&
    timingSafeEqual(derived, stored)
  );
}

export function createSessionToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!timingSafeStringEqual(signValue(encodedPayload), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    if (!payload?.userId || payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();

  if (!session?.userId) {
    const error = new Error("Unauthorized.");
    error.status = 401;
    throw error;
  }

  return session;
}

export async function requireSameOriginSession(request) {
  assertSameOriginRequest(request);
  return requireSession();
}
