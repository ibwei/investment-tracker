import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import { consumeRegistrationVerificationCode } from "@/lib/email-verification";
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

const USER_FIELDS = `
  id,
  email,
  password_hash as "passwordHash",
  name,
  role,
  status,
  storage_mode as "storageMode",
  timezone,
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

const AUTH_ACCOUNT_FIELDS = `
  auth_accounts.id,
  auth_accounts.user_id as "userId",
  auth_accounts.provider,
  auth_accounts.provider_account_id as "providerAccountId",
  auth_accounts.email,
  auth_accounts.avatar_url as "avatarUrl",
  auth_accounts.created_at as "createdAt",
  auth_accounts.updated_at as "updatedAt"
`;

function isUniqueViolation(error) {
  return error?.code === "23505";
}

type UserRow = {
  id: number;
  email: string;
  passwordHash: string;
  name: string | null;
  role: string;
  status: string;
  storageMode: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

type AuthAccountWithUserRow = {
  id: number;
  user: UserRow;
};

export async function getUserTimeZone(id) {
  if (!id) {
    return DEFAULT_APP_TIMEZONE;
  }

  const user = await queryOne<{ timezone?: string }>(
    `select timezone from users where id = $1 limit 1`,
    [Number(id)]
  );

  return normalizeTimeZone(user?.timezone);
}

export async function getUserById(id) {
  if (!id) {
    return null;
  }

  const user = await queryOne(`select ${USER_FIELDS} from users where id = $1 limit 1`, [
    Number(id)
  ]);

  return user ? mapUser(user) : null;
}

export async function registerUser(input) {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const name = normalizeText(input.name) || null;

  const existingUser = await queryOne(`select id from users where email = $1 limit 1`, [
    email
  ]);

  assert(!existingUser, "An account with this email already exists.", 409);
  await consumeRegistrationVerificationCode(email, input.verificationCode);

  const timestamp = now();
  const user = await queryOne(
    `
      insert into users (
        email, password_hash, name, role, status, storage_mode, timezone, created_at, updated_at
      )
      values ($1, $2, $3, 'USER', 'ACTIVE', 'REMOTE', $4, $5, $5)
      returning ${USER_FIELDS}
    `,
    [email, hashPassword(password), name, DEFAULT_APP_TIMEZONE, timestamp]
  ).catch((error) => {
    if (isUniqueViolation(error)) {
      assert(false, "An account with this email already exists.", 409);
    }
    throw error;
  });

  return mapUser(user);
}

export async function loginUser(input) {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);

  const user = await queryOne(`select ${USER_FIELDS} from users where email = $1 limit 1`, [
    email
  ]);

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

  const current = await queryOne(`select ${USER_FIELDS} from users where id = $1 limit 1`, [
    Number(userId)
  ]);

  assert(current, "User not found.", 404);

  if (input.email !== undefined && normalizeEmail(input.email) !== current.email) {
    assert(false, "Email cannot be changed.", 400);
  }

  const name = normalizeText(input.name ?? current.name) || null;
  const timezone = normalizeTimeZone(input.timezone ?? current.timezone);

  const user = await queryOne(
    `
      update users
      set name = $1, timezone = $2, updated_at = $3
      where id = $4
      returning ${USER_FIELDS}
    `,
    [name, timezone, now(), current.id]
  );

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

  const existingAccount = await queryOne<AuthAccountWithUserRow>(
    `
      select
        ${AUTH_ACCOUNT_FIELDS},
        row_to_json(user_row) as "user"
      from auth_accounts
      join lateral (
        select ${USER_FIELDS}
        from users
        where users.id = auth_accounts.user_id
      ) user_row on true
      where provider = $1 and provider_account_id = $2
      limit 1
    `,
    [provider, providerAccountId]
  );

  if (existingAccount?.user) {
    const user = await withTransaction(async (client) => {
      const updated = await client.query(
        `
          update users
          set name = $1, timezone = $2, updated_at = $3
          where id = $4
          returning ${USER_FIELDS}
        `,
        [
          name ?? existingAccount.user.name,
          normalizeTimeZone(existingAccount.user.timezone),
          timestamp,
          existingAccount.user.id
        ]
      );

      await client.query(
        `
          update auth_accounts
          set email = $1, avatar_url = $2, updated_at = $3
          where id = $4
        `,
        [email, avatarUrl, timestamp, existingAccount.id]
      );

      return updated.rows[0];
    });

    return mapUser(user);
  }

  const existingUser = await queryOne<UserRow>(
    `select ${USER_FIELDS} from users where email = $1 limit 1`,
    [email]
  );

  if (existingUser) {
    const user = await withTransaction(async (client) => {
      await client.query(
        `
          insert into auth_accounts (
            user_id, provider, provider_account_id, email, avatar_url, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $6)
          on conflict (user_id, provider)
          do update set
            provider_account_id = excluded.provider_account_id,
            email = excluded.email,
            avatar_url = excluded.avatar_url,
            updated_at = excluded.updated_at
        `,
        [existingUser.id, provider, providerAccountId, email, avatarUrl, timestamp]
      );

      const updated = await client.query(
        `
          update users
          set name = $1, timezone = $2, updated_at = $3
          where id = $4
          returning ${USER_FIELDS}
        `,
        [
          name ?? existingUser.name,
          normalizeTimeZone(existingUser.timezone),
          timestamp,
          existingUser.id
        ]
      );

      return updated.rows[0];
    });

    return mapUser(user);
  }

  const user = await withTransaction(async (client) => {
    const created = await client.query(
      `
        insert into users (
          email, password_hash, name, role, status, storage_mode, timezone, created_at, updated_at
        )
        values ($1, $2, $3, 'USER', 'ACTIVE', 'REMOTE', $4, $5, $5)
        returning ${USER_FIELDS}
      `,
      [email, createPlaceholderPasswordHash(), name, DEFAULT_APP_TIMEZONE, timestamp]
    );

    await client.query(
      `
        insert into auth_accounts (
          user_id, provider, provider_account_id, email, avatar_url, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $6)
      `,
      [created.rows[0].id, provider, providerAccountId, email, avatarUrl, timestamp]
    );

    return created.rows[0];
  });

  return mapUser(user);
}
