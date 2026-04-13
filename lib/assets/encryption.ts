import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const KEY_ENV_NAME = "ASSET_CREDENTIAL_ENCRYPTION_KEY";
const MIN_PASSPHRASE_LENGTH = 32;

function getAssetCredentialEncryptionKey() {
  const value = process.env[KEY_ENV_NAME]?.trim();

  if (!value) {
    throw new Error(`${KEY_ENV_NAME} is required to encrypt asset API credentials.`);
  }

  if (value.startsWith("base64:")) {
    const key = Buffer.from(value.slice("base64:".length), "base64");
    if (key.length !== 32) {
      throw new Error(`${KEY_ENV_NAME} base64 value must decode to 32 bytes.`);
    }
    return key;
  }

  if (value.startsWith("hex:")) {
    const key = Buffer.from(value.slice("hex:".length), "hex");
    if (key.length !== 32) {
      throw new Error(`${KEY_ENV_NAME} hex value must decode to 32 bytes.`);
    }
    return key;
  }

  if (value.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`${KEY_ENV_NAME} must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }

  return createHash("sha256").update(value, "utf8").digest();
}

export function encryptAssetConfig(payload: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getAssetCredentialEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    content: encrypted.toString("base64"),
  });
}

export function decryptAssetConfig(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const payload = JSON.parse(value);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getAssetCredentialEncryptionKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.content, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
