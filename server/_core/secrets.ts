import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey(version?: string): Buffer {
  const configured = process.env.SECRETS_ENCRYPTION_KEY;
  if (configured && version !== "v1d") {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length !== 32)
      throw new Error("SECRETS_ENCRYPTION_KEY deve ter 32 bytes em base64");
    return decoded;
  }
  const jwt = process.env.JWT_SECRET;
  if (!jwt)
    throw new Error("JWT_SECRET não configurada para proteger credenciais");
  return crypto
    .createHash("sha256")
    .update(`credential-encryption:${jwt}`)
    .digest();
}

export function encryptSecret(value: string): string {
  const version = process.env.SECRETS_ENCRYPTION_KEY ? "v1" : "v1d";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(version), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    version,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (
    !["v1", "v1d"].includes(version) ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  )
    throw new Error("Segredo criptografado inválido");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    encryptionKey(version),
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function secretHint(value: string): string {
  return value.length <= 8
    ? "••••••••"
    : `${value.slice(0, 3)}••••${value.slice(-4)}`;
}
