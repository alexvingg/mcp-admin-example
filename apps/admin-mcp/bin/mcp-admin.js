#!/usr/bin/env node
/**
 * Dispatcher do CLI do admin-mcp.
 *
 * Subcomandos:
 *   mcp-admin login    - PKCE flow no browser, salva tokens
 *   mcp-admin logout   - apaga tokens
 *   mcp-admin status   - mostra usuário logado e permissions
 *   mcp-admin server   - sobe MCP server em stdio (chamado pelo Claude Code)
 *
 * Sem args (ou comando desconhecido), imprime usage.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const subcommand = process.argv[2];

if (subcommand === "server") {
  await import(resolve(root, "dist/server.js"));
} else if (["login", "logout", "status"].includes(subcommand ?? "")) {
  await import(resolve(root, "dist/cli.js"));
} else {
  console.error("Usage: mcp-admin <login|logout|status|server>");
  process.exit(1);
}
