import { jwtSecret } from "./authToken";

export function validateRuntimeEnvironment() {
  jwtSecret();
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL não configurada");
  const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
  if (encryptionKey && Buffer.from(encryptionKey, "base64").length !== 32)
    throw new Error(
      "SECRETS_ENCRYPTION_KEY deve conter 32 bytes codificados em base64"
    );
  if (!encryptionKey)
    console.warn(
      "[Security] SECRETS_ENCRYPTION_KEY ausente; usando chave derivada do JWT_SECRET temporariamente."
    );
  const forbiddenPublicSecrets = [
    "VITE_GROQ_API_KEY",
    "VITE_GEMINI_API_KEY",
    "VITE_DEEP_SEEK_API_KEY",
  ];
  const exposed = forbiddenPublicSecrets.filter(key => process.env[key]);
  if (exposed.length)
    console.warn(`[Security] Remova segredos públicos: ${exposed.join(", ")}`);
}
