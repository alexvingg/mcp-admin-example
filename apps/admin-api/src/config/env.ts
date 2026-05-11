/**
 * Carrega e valida variáveis de ambiente.
 * Falha rápido (na inicialização) se algo essencial faltar.
 */
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().url(),
  AUTH0_ISSUER_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Pre-shared key usado pela Auth0 Action ao chamar /internal/permissions
  INTERNAL_PSK: z.string().min(16, "INTERNAL_PSK deve ter ao menos 16 chars"),
  // sub Auth0 do user que recebe entitlements no seed inicial.
  // Específico do tenant — quem fizer fork preenche o sub do próprio user@demo.local.
  // Se vazio/undefined, o seed é pulado (admin continua funcionando via bypass).
  DEMO_ENTITLED_USER_SUB: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("✗ Configuração inválida:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
