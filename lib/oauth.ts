import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const OAUTH_STATE_COOKIE_PREFIX = "earn_compass_oauth_state_";
const OAUTH_STATE_MAX_AGE = 60 * 10;

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getBaseUrl(request) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (configured) {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw createError("Configured app URL is invalid.", 500);
    }
    return url.origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw createError("APP_URL is required in production.", 500);
  }

  return new URL(request.url).origin;
}

function getProviderEnv(provider) {
  switch (provider) {
    case "google":
      return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
      };
    case "github":
      return {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET
      };
    default:
      throw createError("Unsupported OAuth provider.", 400);
  }
}

export function getOAuthProviderAvailability() {
  return {
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    github: Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    )
  };
}

function ensureProviderConfigured(provider) {
  const config = getProviderEnv(provider);

  if (!config.clientId || !config.clientSecret) {
    throw createError("OAuth provider is not configured.", 503);
  }

  return config;
}

function getCallbackUrl(request, provider) {
  return `${getBaseUrl(request)}/api/auth/oauth/${provider}/callback`;
}

function getStateCookieName(provider) {
  return `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
}

export async function createOAuthState(provider) {
  const cookieStore = await cookies();
  const state = randomBytes(24).toString("hex");

  cookieStore.set(getStateCookieName(provider), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE
  });

  return state;
}

export async function verifyOAuthState(provider, state) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(getStateCookieName(provider))?.value;
  cookieStore.delete(getStateCookieName(provider));

  if (!cookieValue || !state) {
    throw createError("OAuth state is invalid or expired.", 400);
  }

  const expected = Buffer.from(cookieValue);
  const actual = Buffer.from(String(state));

  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    throw createError("OAuth state is invalid or expired.", 400);
  }
}

function toFormBody(payload) {
  return new URLSearchParams(
    Object.entries(payload).reduce((entries, [key, value]) => {
      entries[key] = String(value);
      return entries;
    }, {})
  );
}

async function parseJsonResponse(response, fallbackMessage) {
  let payload;

  try {
    payload = await response.json();
  } catch {
    throw createError(fallbackMessage, response.status || 500);
  }

  if (!response.ok) {
    throw createError(
      payload?.error_description || payload?.message || payload?.error || fallbackMessage,
      response.status || 500
    );
  }

  return payload;
}

function normalizeOAuthProfile(profile) {
  return {
    provider: profile.provider,
    providerAccountId: String(profile.providerAccountId),
    email: String(profile.email).toLowerCase(),
    name: profile.name ? String(profile.name) : null,
    avatarUrl: profile.avatarUrl ? String(profile.avatarUrl) : null
  };
}

async function exchangeGoogleCode(request, code) {
  const { clientId, clientSecret } = ensureProviderConfigured("google");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: toFormBody({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getCallbackUrl(request, "google"),
      grant_type: "authorization_code"
    })
  });

  const token = await parseJsonResponse(response, "OAuth sign in failed.");
  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    },
    cache: "no-store"
  });
  const profile = await parseJsonResponse(userResponse, "OAuth sign in failed.");

  if (!profile?.sub || !profile?.email || !profile?.email_verified) {
    throw createError("Google account email is unavailable or not verified.", 400);
  }

  return normalizeOAuthProfile({
    provider: "google",
    providerAccountId: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture
  });
}

async function resolveGithubEmail(accessToken, fallbackEmail) {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "earn-compass"
    },
    cache: "no-store"
  });

  const emails = await parseJsonResponse(response, "OAuth sign in failed.");
  const normalizedFallback = fallbackEmail ? String(fallbackEmail).toLowerCase() : null;
  const primaryVerified = Array.isArray(emails)
    ? emails.find((item) => item.verified && String(item.email).toLowerCase() === normalizedFallback) ||
      emails.find((item) => item.primary && item.verified) ||
      emails.find((item) => item.verified)
    : null;

  return primaryVerified?.email ?? null;
}

async function exchangeGithubCode(request, code) {
  const { clientId, clientSecret } = ensureProviderConfigured("github");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: toFormBody({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getCallbackUrl(request, "github")
    })
  });

  const token = await parseJsonResponse(tokenResponse, "OAuth sign in failed.");
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "earn-compass"
    },
    cache: "no-store"
  });
  const profile = await parseJsonResponse(userResponse, "OAuth sign in failed.");
  const email = await resolveGithubEmail(token.access_token, profile?.email);

  if (!profile?.id || !email) {
    throw createError("GitHub account email is unavailable or not verified.", 400);
  }

  return normalizeOAuthProfile({
    provider: "github",
    providerAccountId: profile.id,
    email,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url
  });
}

export async function getOAuthProfile(request, provider, code) {
  if (!code) {
    throw createError("OAuth authorization was denied.", 400);
  }

  switch (provider) {
    case "google":
      return exchangeGoogleCode(request, code);
    case "github":
      return exchangeGithubCode(request, code);
    default:
      throw createError("Unsupported OAuth provider.", 400);
  }
}

export async function getOAuthAuthorizationUrl(request, provider) {
  const { clientId } = ensureProviderConfigured(provider);
  const state = await createOAuthState(provider);
  const redirectUri = getCallbackUrl(request, provider);

  switch (provider) {
    case "google": {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "select_account");
      return url.toString();
    }
    case "github": {
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "read:user user:email");
      url.searchParams.set("state", state);
      return url.toString();
    }
    default:
      throw createError("Unsupported OAuth provider.", 400);
  }
}

export function buildOAuthErrorRedirect(request, provider, message) {
  const url = new URL("/login", getBaseUrl(request));
  url.searchParams.set("oauth_error", message);
  url.searchParams.set("provider", provider);
  return url;
}
