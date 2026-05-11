/**
 * checkJwt: valida o JWT (assinatura via JWKS, audience, issuer).
 * Em caso de erro, devolve 401 estruturado.
 */
import { auth } from "express-oauth2-jwt-bearer";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env.js";

export const checkJwt: RequestHandler = auth({
  audience: env.AUTH0_AUDIENCE,
  issuerBaseURL: env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: "RS256",
});

/**
 * Converte erros do auth middleware (UnauthorizedError) em JSON.
 * Posiciona depois das rotas autenticadas (mas antes do errorHandler global).
 */
export const jwtErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err?.name === "UnauthorizedError" || err?.status === 401) {
    return res.status(401).json({
      error: "unauthorized",
      message: err.message ?? "Invalid or missing token",
    });
  }
  next(err);
};
