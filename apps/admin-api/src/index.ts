/**
 * admin-api — Express server protegido por Auth0 JWT (RBAC + scopes).
 *
 * Rotas públicas:
 *   GET  /api/health
 *
 * Rotas autenticadas (Bearer JWT):
 *   GET  /api/me                                      (qualquer JWT válido)
 *   /api/customers/*                                  (scopes read|write|delete:customers)
 *     - GET /:id passa por requireCustomerAccess (Tier 2)
 *     - POST /:id/access-request cria grant (válido por TTL)
 *   GET  /api/grants/me                               (lista grants ativos)
 *   /api/products/*                                   (scopes read|write|delete:products)
 *
 * Endpoints internos (DEPRECATED, mantido como stub):
 *   POST /internal/permissions
 */
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { checkJwt, jwtErrorHandler } from "./middleware/auth.js";
import { customersRouter } from "./modules/customers/customer.routes.js";
import { productsRouter } from "./modules/products/product.routes.js";
import { internalRouter } from "./modules/internal/internal.routes.js";
import { customerEntitlementsStore } from "./modules/internal/customer-entitlements.store.js";
import { myGrantsRouter } from "./modules/grants/grant.routes.js";
import { prisma } from "./lib/prisma.js";
import { HttpError } from "./errors/httpError.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(morgan("dev"));

// ─── Rotas públicas ──────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── Rota autenticada de introspecção do token ──────────────
app.get("/api/me", checkJwt, (req, res) => {
  const payload = (req as any).auth?.payload ?? {};
  res.json({
    sub: payload.sub,
    aud: payload.aud,
    iss: payload.iss,
    azp: payload.azp,
    scope: payload.scope,
    permissions: payload.permissions ?? [],
    iat: payload.iat,
    exp: payload.exp,
  });
});

// ─── CRUDs ───────────────────────────────────────────────────
app.use("/api/customers", customersRouter);
app.use("/api/products",  productsRouter);

// ─── Grants ──────────────────────────────────────────────────
// O endpoint `POST /api/customers/:id/access-request` é montado dentro do
// customersRouter (em customer.routes.ts) pra herdar o caminho.
app.use("/api/grants/me", myGrantsRouter);

// ─── Endpoints internos (DEPRECATED) ─────────────────────────
app.use("/internal", internalRouter);

// ─── Error handlers ──────────────────────────────────────────
app.use(jwtErrorHandler);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.name,
      message: err.message,
      details: err.details,
    });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "internal_error", message: "Something went wrong" });
};
app.use(errorHandler);

// ─── Seed do entitlements store ─────────────────────────────
// Em produção isto vira tabela `customer_entitlements (user_sub, customer_id)`
// gerida via UI admin. Pra demo: hardcode pros 2 primeiros customers.
//
// O sub do user vem de env (DEMO_ENTITLED_USER_SUB). Se não configurado,
// o seed é pulado — admin continua funcionando (bypass), apenas o user@demo.local
// não terá entitlements até alguém criar via UI admin (não existe ainda) ou
// editar o .env.
async function seedEntitlementsStore() {
  try {
    const userSub = env.DEMO_ENTITLED_USER_SUB;
    if (!userSub) {
      console.warn(
        "⚠ DEMO_ENTITLED_USER_SUB não configurado — entitlement seed pulado. " +
        "Defina no .env com o sub do user@demo.local do seu tenant Auth0.",
      );
      return;
    }

    const customers = await prisma.customer.findMany({
      take: 2,
      orderBy: { createdAt: "asc" },
    });
    if (customers.length === 0) {
      console.warn("⚠ Nenhum customer no banco — seed de entitlements pulado");
      return;
    }

    const ids = customers.map((c) => c.id);
    customerEntitlementsStore.set(userSub, ids);

    console.log(`✓ entitlements seed: ${userSub} → ${ids.length} customers`);
    ids.forEach((id, i) => console.log(`    [${i + 1}] ${id} (${customers[i].name})`));
  } catch (err) {
    console.error("✗ Falha no seed de entitlements:", err);
  }
}

// ─── Bootstrap ───────────────────────────────────────────────
const port = env.PORT;
app.listen(port, async () => {
  console.log(`✓ admin-api listening on http://localhost:${port}`);
  console.log(`  Auth0 issuer:   ${env.AUTH0_ISSUER_BASE_URL}`);
  console.log(`  Auth0 audience: ${env.AUTH0_AUDIENCE}`);
  await seedEntitlementsStore();
});
