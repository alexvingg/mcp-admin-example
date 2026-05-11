/**
 * Rotas REST de grants.
 *
 * POST /api/customers/:id/access-request — cria um grant ativo
 *   - Tier 1: requireScope("read:customers")
 *   - Tier 1.5: SE não-admin, valida entitlement (no service)
 *   - Resposta: 201 com o grant (incluindo expiresAt)
 *
 * DELETE /api/customers/:id/access-request — revoga grant antes do TTL
 *   - Idempotente (sempre 204 mesmo se grant não existia)
 *
 * GET  /api/grants/me — lista grants ativos do user
 *   - Pra UI mostrar "tem N acessos ativos, expirando em..."
 */
import { Router, type RequestHandler } from "express";
import { checkJwt } from "../../middleware/auth.js";
import { requireScope } from "../../middleware/requireScope.js";
import { grantService, NoEntitlementError } from "./grant.service.js";
import { grantStore } from "./grant.store.js";

const customerAccessRequestRouter = Router({ mergeParams: true });
customerAccessRequestRouter.use(checkJwt);

// POST /api/customers/:id/access-request
customerAccessRequestRouter.post(
  "/",
  requireScope("read:customers"),
  ((req, res, next) => {
    const payload: any = (req as any).auth?.payload ?? {};
    const userSub: string = payload.sub;
    const permissions: string[] = payload.permissions ?? [];
    const isAdmin =
      permissions.includes("write:customers") ||
      permissions.includes("delete:customers");

    try {
      const grant = grantService.requestAccess({
        userSub,
        customerId: req.params.id,
        isAdmin,
      });

      res.status(201).json({
        userSub: grant.userSub,
        customerId: grant.customerId,
        grantedAt: grant.grantedAt.toISOString(),
        expiresAt: grant.expiresAt.toISOString(),
        ttlSeconds: grantService.ttlSeconds(),
      });
    } catch (err) {
      if (err instanceof NoEntitlementError) {
        return res.status(err.status).json({
          error: "no_entitlement",
          message: err.message,
        });
      }
      next(err);
    }
  }) as RequestHandler,
);

// DELETE /api/customers/:id/access-request — revoga grant manualmente
customerAccessRequestRouter.delete(
  "/",
  requireScope("read:customers"),
  ((req, res) => {
    const payload: any = (req as any).auth?.payload ?? {};
    const userSub: string = payload.sub;
    const removed = grantStore.revoke(userSub, req.params.id);
    console.log(
      `[grant] revoked  user=${userSub}  customer=${req.params.id}  existed=${removed}`,
    );
    res.status(204).send();
  }) as RequestHandler,
);

// GET /api/grants/me — lista grants ativos do user logado
const myGrantsRouter = Router();
myGrantsRouter.use(checkJwt);
myGrantsRouter.get(
  "/",
  requireScope("read:customers"),
  ((req, res) => {
    const payload: any = (req as any).auth?.payload ?? {};
    const userSub: string = payload.sub;
    const grants = grantService.listMine(userSub).map((g) => ({
      customerId: g.customerId,
      grantedAt: g.grantedAt.toISOString(),
      expiresAt: g.expiresAt.toISOString(),
    }));
    res.json({ grants, ttlSeconds: grantService.ttlSeconds() });
  }) as RequestHandler,
);

export { customerAccessRequestRouter, myGrantsRouter };
