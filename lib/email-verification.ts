import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { sendEmail } from "@/lib/email";
import { execute, queryOne, withTransaction } from "@/lib/db";

const PURPOSE_REGISTER = "REGISTER";
const CODE_TTL_MINUTES = 10;
const SEND_COOLDOWN_SECONDS = 60;

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

export function normalizeVerificationEmail(value) {
  const email = normalizeText(value).toLowerCase();
  assert(email, "Email is required.");
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Please enter a valid email.");
  return email;
}

function now() {
  return new Date().toISOString();
}

function getVerificationSecret() {
  return process.env.AUTH_SECRET || "earn-compass-dev-secret";
}

function hashCode(email, code) {
  return createHash("sha256")
    .update(`${email}:${code}:${getVerificationSecret()}`)
    .digest("hex");
}

function codeMatches(email, code, storedHash) {
  const expected = Buffer.from(hashCode(email, code), "hex");
  const stored = Buffer.from(String(storedHash ?? ""), "hex");

  return expected.length === stored.length && timingSafeEqual(expected, stored);
}

function createVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function buildVerificationEmail(code) {
  return {
    subject: "Earn Compass email verification code",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #111827;">
        <p>Your Earn Compass verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p>
        <p>This code expires in ${CODE_TTL_MINUTES} minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
    text: `Your Earn Compass verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`
  };
}

export async function sendRegistrationVerificationCode(input) {
  const email = normalizeVerificationEmail(input.email);

  const existingUser = await queryOne<{ id: number }>(`select id from users where email = $1 limit 1`, [email]);
  assert(!existingUser, "An account with this email already exists.", 409);

  const latestCode = await queryOne<{ createdAt: string }>(
    `
      select created_at as "createdAt"
      from email_verification_codes
      where email = $1 and purpose = $2
      order by created_at desc
      limit 1
    `,
    [email, PURPOSE_REGISTER]
  );

  if (latestCode?.createdAt) {
    const nextAllowedAt = new Date(latestCode.createdAt).getTime() + SEND_COOLDOWN_SECONDS * 1000;
    assert(Date.now() >= nextAllowedAt, "Please wait before requesting another verification code.", 429);
  }

  const code = createVerificationCode();
  const timestamp = now();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  await execute(
    `
      update email_verification_codes
      set consumed_at = $3
      where email = $1 and purpose = $2 and consumed_at is null
    `,
    [email, PURPOSE_REGISTER, timestamp]
  );

  await execute(
    `
      insert into email_verification_codes (
        email, code_hash, purpose, expires_at, created_at
      )
      values ($1, $2, $3, $4, $5)
    `,
    [email, hashCode(email, code), PURPOSE_REGISTER, expiresAt, timestamp]
  );

  const message = buildVerificationEmail(code);
  try {
    await sendEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text
    });
  } catch (error) {
    await execute(
      `
        update email_verification_codes
        set consumed_at = $3
        where email = $1 and purpose = $2 and code_hash = $4 and consumed_at is null
      `,
      [email, PURPOSE_REGISTER, now(), hashCode(email, code)]
    ).catch(() => undefined);
    throw error;
  }

  return {
    ok: true,
    expiresInSeconds: CODE_TTL_MINUTES * 60
  };
}

export async function consumeRegistrationVerificationCode(emailInput, codeInput, transactionClient = null) {
  const email = normalizeVerificationEmail(emailInput);
  const code = normalizeText(codeInput);

  assert(/^\d{6}$/.test(code), "Verification code is invalid.");

  async function consumeWithClient(client) {
    const result = await client.query(
      `
        select id, code_hash as "codeHash", expires_at as "expiresAt"
        from email_verification_codes
        where email = $1 and purpose = $2 and consumed_at is null
        order by created_at desc
        limit 1
      `,
      [email, PURPOSE_REGISTER]
    );
    const record = result.rows[0];

    assert(record, "Verification code is invalid.", 400);
    assert(new Date(record.expiresAt).getTime() >= Date.now(), "Verification code has expired.", 400);
    assert(codeMatches(email, code, record.codeHash), "Verification code is invalid.", 400);

    await client.query(
      `
        update email_verification_codes
        set consumed_at = $2
        where id = $1
      `,
      [record.id, now()]
    );

    return true;
  }

  if (transactionClient) {
    return consumeWithClient(transactionClient);
  }

  return withTransaction(consumeWithClient, { retryTransient: true });
}
