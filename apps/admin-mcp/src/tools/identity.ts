/**
 * Tool `whoami` — retorna a identidade do user logado, role inferida e
 * permissions do JWT. Útil pro Claude entender "como qual user estou rodando?".
 *
 * Os dados vêm do GET /api/me (que já decoda o JWT no backend), garantindo que
 * é a verdade do backend (não a do MCP).
 */
import { apiFetch } from "../api/client.js";
import type { Tool } from "./types.js";

interface MePayload {
  sub: string;
  aud: string | string[];
  iss: string;
  azp: string;
  scope: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export const identityTools: Tool[] = [
  {
    name: "whoami",
    description:
      "Show the currently logged-in user identity (sub, role, permissions, scope, token expiry). " +
      "Useful as a first call to understand which profile is active.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const me = await apiFetch<MePayload>("/api/me");
      const isAdmin =
        me.permissions.includes("write:customers") ||
        me.permissions.includes("delete:customers");
      return {
        sub: me.sub,
        role: isAdmin ? "admin" : me.permissions.length > 0 ? "user" : "unknown",
        permissions: me.permissions,
        scope: me.scope,
        token_expires_at: new Date(me.exp * 1000).toISOString(),
        token_expires_in_seconds: Math.max(0, me.exp - Math.floor(Date.now() / 1000)),
        issuer: me.iss,
        audience: me.aud,
      };
    },
  },
];
