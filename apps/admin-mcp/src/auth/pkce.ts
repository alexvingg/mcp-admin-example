/**
 * Gera o par PKCE (Proof Key for Code Exchange) — RFC 7636.
 *
 * code_verifier:  random bytes base64url, 43-128 chars
 * code_challenge: SHA256(verifier), base64url
 *
 * SDK pública e simples — não traz dependência extra.
 */
import { createHash, randomBytes } from "node:crypto";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function generatePkce(): PkcePair {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function randomState(bytes = 16): string {
  return base64url(randomBytes(bytes));
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
