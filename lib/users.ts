import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { DEFAULT_APP_TIMEZONE, resolveAppTimeZone } from "@/lib/time";

function assert(condition, message, status = 400) {
  if (!condition) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase();
  assert(email, "Email is required.");
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Please enter a valid email.");
  return email;
}

function normalizePassword(value) {
  const password = String(value ?? "");
  assert(password.length >= 8, "Password must be at least 8 characters.");
  return password;
}

function now() {
  return new Date().toISOString();
}

function normalizeTimeZone(value) {
  return resolveAppTimeZone(String(value ?? "").trim() || DEFAULT_APP_TIMEZONE);
}

function createPlaceholderPasswordHash() {
  return hashPassword(randomBytes(32).toString("hex"));
}

function mapUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    storageMode: user.storageMode,
    timezone: normalizeTimeZone(user.timezone),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function getUserTimeZone(id) {
  if (!id) {
    return DEFAULT_APP_TIMEZONE;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: Number(id)
    },
    select: {
      timezone: true
    }
  });

  return normalizeTimeZone(user?.timezone);
}

export async function getUserById(id) {
  if (!id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: Number(id)
    }
  });

  return user ? mapUser(user) : null;
}

export async function registerUser(input) {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const name = normalizeText(input.name) || null;

  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });

  assert(!existingUser, "An account with this email already exists.", 409);

  const timestamp = now();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      name,
      role: "USER",
      status: "ACTIVE",
      storageMode: "REMOTE",
      timezone: DEFAULT_APP_TIMEZONE,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  });

  return mapUser(user);
}

export async function loginUser(input) {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);

  const user = await prisma.user.findUnique({
    where: {
      email
    }
  });

  assert(user, "Invalid email or password.", 401);
  assert(
    verifyPassword(password, user.passwordHash),
    "Invalid email or password.",
    401
  );

  return mapUser(user);
}

export async function updateUserProfile(userId, input) {
  assert(userId, "Unauthorized.", 401);

  const current = await prisma.user.findUnique({
    where: {
      id: Number(userId)
    }
  });

  assert(current, "User not found.", 404);

  const email = normalizeEmail(input.email ?? current.email);
  const name = normalizeText(input.name ?? current.name) || null;
  const timezone = normalizeTimeZone(input.timezone ?? current.timezone);

  if (email !== current.email) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    });

    assert(!existingUser || existingUser.id === current.id, "Email is already in use.", 409);
  }

  const user = await prisma.user.update({
    where: {
      id: current.id
    },
    data: {
      email,
      name,
      timezone,
      updatedAt: now()
    }
  });

  return mapUser(user);
}

function normalizeProvider(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeProviderAccountId(value) {
  const providerAccountId = normalizeText(value);
  assert(providerAccountId, "OAuth account identifier is required.");
  return providerAccountId;
}

export async function findOrCreateOAuthUser(input) {
  const provider = normalizeProvider(input.provider);
  const providerAccountId = normalizeProviderAccountId(input.providerAccountId);
  const email = normalizeEmail(input.email);
  const name = normalizeText(input.name) || null;
  const avatarUrl = normalizeText(input.avatarUrl) || null;
  const timestamp = now();

  const existingAccount = await prisma.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId
      }
    },
    include: {
      user: true
    }
  });

  if (existingAccount?.user) {
    const user = await prisma.user.update({
      where: {
        id: existingAccount.user.id
      },
      data: {
        email,
        name: name ?? existingAccount.user.name,
        timezone: normalizeTimeZone(existingAccount.user.timezone),
        updatedAt: timestamp
      }
    });

    await prisma.authAccount.update({
      where: {
        id: existingAccount.id
      },
      data: {
        email,
        avatarUrl,
        updatedAt: timestamp
      }
    });

    return mapUser(user);
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existingUser) {
    await prisma.authAccount.upsert({
      where: {
        userId_provider: {
          userId: existingUser.id,
          provider
        }
      },
      update: {
        providerAccountId,
        email,
        avatarUrl,
        updatedAt: timestamp
      },
      create: {
        userId: existingUser.id,
        provider,
        providerAccountId,
        email,
        avatarUrl,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    const user = await prisma.user.update({
      where: {
        id: existingUser.id
      },
      data: {
        name: name ?? existingUser.name,
        timezone: normalizeTimeZone(existingUser.timezone),
        updatedAt: timestamp
      }
    });

    return mapUser(user);
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: createPlaceholderPasswordHash(),
      name,
      role: "USER",
      status: "ACTIVE",
      storageMode: "REMOTE",
      timezone: DEFAULT_APP_TIMEZONE,
      createdAt: timestamp,
      updatedAt: timestamp,
      authAccounts: {
        create: {
          provider,
          providerAccountId,
          email,
          avatarUrl,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      }
    }
  });

  return mapUser(user);
}
