/**
 * requireScope: verifica se o JWT contém uma permission específica.
 *
 * Auth0 com "Add Permissions in Access Token" habilitado coloca o array em
 * payload.permissions (do RBAC). Também aceitamos o claim 'scope' (string com espaços)
 * como fallback.
 *
 * Falha → 403 com lista de permissions necessárias x concedidas.
 */
import type { RequestHandler } from "express";

interface AuthPayload {
  permissions?: string[];
  scope?: string;
  [k: string]: unknown;
}

export function requireScope(...required: string[]): RequestHandler {
  return (req, res, next) => {
    // express-oauth2-jwt-bearer expõe o payload em req.auth.payload
    const auth = (req as any).auth;
    const payload: AuthPayload = auth?.payload ?? {};

    const granted = new Set<string>([
      ...(payload.permissions ?? []),
      ...((payload.scope ?? "").split(" ").filter(Boolean)),
    ]);

    const missing = required.filter((s) => !granted.has(s));

    if (missing.length > 0) {
      return res.status(403).json({
        error: "insufficient_scope",
        message: `Missing required permission${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
        required,
        granted: Array.from(granted),
      });
    }

    next();
  };
}
