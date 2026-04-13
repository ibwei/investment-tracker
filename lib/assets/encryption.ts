import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getKeyMaterial() {
  const value =
    process.env.ASSET_CREDENTIAL_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "earn-compass-assets-dev-key";

  return createHash("sha256").update(value).digest();
}

export function encryptAssetConfig(payload: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKeyMaterial(), iv);
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
    getKeyMaterial(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.content, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
