import { Router } from "express";
import { checkJwt } from "../../middleware/auth.js";
import { requireScope } from "../../middleware/requireScope.js";
import { requireCustomerAccess } from "../../middleware/requireCustomerAccess.js";
import { customerController } from "./customer.controller.js";
import { customerAccessRequestRouter } from "../grants/grant.routes.js";

const router = Router();

// Todas as rotas exigem JWT válido
router.use(checkJwt);

router.get(
  "/",
  requireScope("read:customers"),
  customerController.list,
);

// Detalhe: 2 tiers — Tier 1 (scope) e Tier 2 (grant ativo via runtime check).
// Admin (com write:customers) bypassa o Tier 2 dentro do middleware.
router.get(
  "/:id",
  requireScope("read:customers"),
  requireCustomerAccess,
  customerController.get,
);

router.post("/",      requireScope("write:customers"),  customerController.create);
router.put("/:id",    requireScope("write:customers"),  customerController.update);
router.delete("/:id", requireScope("delete:customers"), customerController.remove);

// Sub-router de access-request: POST /api/customers/:id/access-request
// Cria um grant ativo (TTL configurável) que libera o middleware Tier 2
// pra próximas chamadas do GET /:id.
router.use("/:id/access-request", customerAccessRequestRouter);

export { router as customersRouter };
