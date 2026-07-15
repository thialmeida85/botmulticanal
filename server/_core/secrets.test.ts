import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, secretHint } from "./secrets";

describe("secret vault", () => {
  const previousKey = process.env.SECRETS_ENCRYPTION_KEY;
  beforeEach(() => { process.env.SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64"); });
  afterEach(() => { process.env.SECRETS_ENCRYPTION_KEY = previousKey; });

  it("encrypts with a random nonce and decrypts the original value", () => {
    const first = encryptSecret("credential-value"); const second = encryptSecret("credential-value");
    expect(first).not.toBe(second); expect(decryptSecret(first)).toBe("credential-value"); expect(decryptSecret(second)).toBe("credential-value");
  });

  it("does not expose the complete value in its hint", () => {
    const hint = secretHint("sk-production-secret-1234");
    expect(hint).toContain("••••"); expect(hint).not.toContain("production-secret");
  });

  it("rejects a modified encrypted value", () => {
    const encrypted = encryptSecret("credential-value");
    expect(() => decryptSecret(`${encrypted.slice(0, -2)}aa`)).toThrow();
  });
});
