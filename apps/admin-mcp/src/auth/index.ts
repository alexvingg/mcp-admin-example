/**
 * API pública usada pelas tools.
 * Centraliza: "me dá um access_token válido AGORA" (com refresh transparente).
 */
import { tokenStore, type StoredTokens } from "./token-store.js";
import { refreshAccessToken } from "./refresh.js";

const REFRESH_THRESHOLD_MS = 60 * 1000; // refresca se faltam <60s pro expires_at

export class NotLoggedInError extends Error {
  constructor() {
    super("Not logged in. Run `mcp-admin login` first.");
    this.name = "NotLoggedInError";
  }
}

/**
 * Retorna um access_token válido. Faz refresh transparente se necessário.
 * Se não há tokens persistidos, lança NotLoggedInError.
 */
export async function getValidAccessToken(): Promise<string> {
  const stored = await tokenStore.load();
  if (!stored) throw new NotLoggedInError();

  const remaining = stored.expires_at - Date.now();
  if (remaining > REFRESH_THRESHOLD_MS) {
    return stored.access_token;
  }

  // Precisa renovar
  const fresh = await refreshAccessToken(stored.refresh_token);

  const updated: Omit<StoredTokens, "saved_at"> = {
    access_token: fresh.access_token,
    // Refresh Token Rotation: substitui o antigo pelo novo (se vier)
    refresh_token: fresh.refresh_token ?? stored.refresh_token,
    id_token: fresh.id_token ?? stored.id_token,
    expires_at: Date.now() + fresh.expires_in * 1000,
    sub: stored.sub,
    email: stored.email,
  };

  await tokenStore.save(updated);
  return updated.access_token;
}

export { tokenStore } from "./token-store.js";
export { login } from "./login.js";
export { decodeJwtPayload } from "./token-store.js";
