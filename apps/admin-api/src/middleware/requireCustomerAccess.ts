/**
 * Tier 2 do esquema de autorização — versão "Híbrido com Redis grants".
 *
 * Diferença pra versão anterior (que lia custom claim do JWT):
 *   - Antes: JWT carregava lista completa de customer_access (não escala)
 *   - Agora: JWT só tem identidade; backend consulta grant store em runtime
 *
 * Inspirado em canShowSensitiveData() (pattern enterprise),
 * que faz HTTP call em runtime pra checar grants no Redis.
 *
 * Fluxo:
 *   1. Admin (write:customers) → bypass automático
 *   2. Não-admin → deve ter um GRANT ATIVO no store pro customer pedido
 *      (criado por POST /api/customers/:id/access-request)
 *   3. Sem grant → 403 com hint pra criar
 */
import type { RequestHandler } from "express";
import { grantService } from "../modules/grants/grant.service.js";

export const requireCustomerAccess: RequestHandler = (req, res, next) => {
  const payload: any = (req as any).auth?.payload ?? {};
  const userSub: string = payload.sub;
  const permissions: string[] = payload.permissions ?? [];

  // Bypass: admin
  const isAdmin =
    permissions.includes("write:customers") ||
    permissions.includes("delete:customers");
  if (isAdmin) return next();

  const requestedId = req.params.id;
  if (!requestedId) {
    return res.status(400).json({
      error: "bad_request",
      message: "Missing :id in path",
    });
  }

  const hasGrant = grantService.hasActiveGrant(userSub, requestedId);
  if (!hasGrant) {
    return res.status(403).json({
      error: "no_active_grant",
      message:
        "No active access grant for this customer. " +
        "Call POST /api/customers/:id/access-request first.",
      hint: {
        method: "POST",
        path: `/api/customers/${requestedId}/access-request`,
        ttlSeconds: grantService.ttlSeconds(),
      },
    });
  }

  next();
};
