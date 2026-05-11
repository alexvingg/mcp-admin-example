/**
 * @deprecated
 * Era usado quando o pattern era "JWT carrega tudo via custom claim".
 *
 * No pattern atual (Híbrido com grants), o JWT só carrega identidade — não
 * faz mais sentido enriquecer no login. A autorização por instância vem
 * via `POST /api/customers/:id/access-request` (que cria grant em runtime).
 *
 * Mantido como STUB porque pode haver uma Auth0 Action ainda em produção
 * chamando esse endpoint. Se chamada, devolve lista vazia — Action pode
 * continuar lá sem efeitos colaterais. Pode-se desabilitar/excluir a Action
 * com segurança.
 */
import { Router, type RequestHandler } from "express";
import { env } from "../../config/env.js";

const requirePsk: RequestHandler = (req, res, next) => {
  const provided = req.header("x-internal-psk");
  if (!provided || provided !== env.INTERNAL_PSK) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Missing or invalid x-internal-psk",
    });
  }
  next();
};

const router = Router();
router.use(requirePsk);

router.post("/permissions", (_req, res) => {
  // Stub: lista sempre vazia. Pattern de autorização migrou pra runtime grants.
  res.json({
    customer_access: [],
    deprecated: true,
    note: "Use POST /api/customers/:id/access-request instead.",
  });
});

export { router as internalRouter };
