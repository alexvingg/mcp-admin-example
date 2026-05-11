/**
 * Persistência local dos tokens em ~/.config/auth0-admin-mcp/tokens.json.
 *
 * Permissão 0600 (só o user dono lê/escreve). Em produção: keychain do OS.
 */
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promises as fs } from "node:fs";

const CONFIG_DIR = join(homedir(), ".config", "auth0-admin-mcp");
const TOKENS_PATH = join(CONFIG_DIR, "tokens.json");

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  /** Unix epoch ms quando o access_token expira. */
  expires_at: number;
  /** id_token decodado (só pra display, não usado em validação). */
  id_token?: string;
  /** sub do user logado (pra display). */
  sub?: string;
  /** email (pra display). */
  email?: string;
  /** Quando o token foi obtido. */
  saved_at: number;
}

export const tokenStore = {
  async load(): Promise<StoredTokens | null> {
    try {
      const raw = await fs.readFile(TOKENS_PATH, "utf8");
      return JSON.parse(raw) as StoredTokens;
    } catch (err: any) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  },

  async save(tokens: Omit<StoredTokens, "saved_at">) {
    await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    const payload: StoredTokens = { ...tokens, saved_at: Date.now() };
    // writeFile com mode garante 0600 mesmo na criação
    await fs.writeFile(TOKENS_PATH, JSON.stringify(payload, null, 2), {
      mode: 0o600,
    });
  },

  async clear() {
    try {
      await fs.unlink(TOKENS_PATH);
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
  },

  path() {
    return TOKENS_PATH;
  },
};

export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1] ?? "";
  const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
  const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
  return JSON.parse(json);
}
