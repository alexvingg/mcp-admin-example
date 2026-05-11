/**
 * usePermissions: lê o access_token do Auth0 e expõe flags semânticas
 * derivadas do array `permissions` (RBAC do Auth0).
 *
 * Decode é client-side somente para UX (esconder botões). A validação
 * REAL é no backend, que verifica assinatura JWS via JWKS.
 */
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

interface JwtPayload {
  permissions?: string[];
  scope?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  [k: string]: unknown;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export interface PermissionsState {
  loading: boolean;
  permissions: string[];
  scope: string;
  has: (perm: string) => boolean;
  // CRUD flags por recurso
  canReadCustomers: boolean;
  canWriteCustomers: boolean;
  canDeleteCustomers: boolean;
  canReadProducts: boolean;
  canWriteProducts: boolean;
  canDeleteProducts: boolean;
  // Role inferida (admin = tem qualquer write/delete; user = só read)
  role: "admin" | "user" | "unknown";
}

export function usePermissions(): PermissionsState {
  const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [scope, setScope] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setPermissions([]);
      setScope("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessTokenSilently();
        const payload = decodeJwt(token);
        if (!cancelled && payload) {
          setPermissions(payload.permissions ?? []);
          setScope(payload.scope ?? "");
          // Debug log — ajuda a verificar se as permissions chegaram
          if (!payload.permissions || payload.permissions.length === 0) {
            console.warn(
              "[usePermissions] JWT decoded but `permissions` is empty.",
              "Verifique RBAC + Add Permissions in Token na API do Auth0.",
              { payload },
            );
          }
        } else if (!cancelled) {
          console.error("[usePermissions] Token decode failed");
        }
      } catch (err) {
        console.error(
          "[usePermissions] getAccessTokenSilently failed:",
          err,
          "→ Possíveis causas: refresh tokens desabilitados, cookies de terceiros bloqueados, audience errado.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently, isAuthenticated, isLoading]);

  const has = (perm: string) => permissions.includes(perm);

  const canWriteAnything =
    has("write:customers") || has("write:products") ||
    has("delete:customers") || has("delete:products");

  return {
    loading,
    permissions,
    scope,
    has,
    canReadCustomers: has("read:customers"),
    canWriteCustomers: has("write:customers"),
    canDeleteCustomers: has("delete:customers"),
    canReadProducts: has("read:products"),
    canWriteProducts: has("write:products"),
    canDeleteProducts: has("delete:products"),
    role: permissions.length === 0
      ? "unknown"
      : canWriteAnything
      ? "admin"
      : "user",
  };
}
