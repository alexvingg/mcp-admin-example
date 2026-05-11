/**
 * Carrega + valida variáveis de ambiente do MCP.
 *
 * Falha rápido (process.exit) se algo essencial faltar — útil pra detectar
 * problema de config antes de Claude Code spawnar o server e quebrar silencioso.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";

// Carrega .env manualmente (evita dependência de dotenv só pra isso)
function loadDotenv() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Procura .env em ../../ (raiz do package, src/../) e ../../.env (apps/admin-mcp/.env)
  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotenv();

const schema = z.object({
  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().url(),
  MCP_CLIENT_ID: z.string().min(8, "MCP_CLIENT_ID parece inválido"),
  API_BASE_URL: z.string().url(),
  PKCE_CALLBACK_PORT: z.coerce.number().int().min(1024).max(65535).default(8765),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Importante: imprime em stderr — stdout é reservado pro protocolo MCP (JSON-RPC)
  console.error("✗ MCP config inválida:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  console.error("\nVerifique apps/admin-mcp/.env (ou env vars passadas pelo Claude Code).");
  process.exit(1);
}

export const env = parsed.data;
