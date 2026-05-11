/**
 * Refresh do access_token usando o refresh_token persistido.
 * Auth0 com Refresh Token Rotation pode emitir um refresh_token NOVO a cada uso —
 * temos que substituir o antigo pelo novo.
 */
import { env } from "../config.js";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function refreshAccessToken(refresh_token: string): Promise<TokenResponse> {
  const res = await fetch(`https://${env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: env.MCP_CLIENT_ID,
      refresh_token,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Refresh token failed: ${res.status} ${body}`);
  }

  return (await res.json()) as TokenResponse;
}
