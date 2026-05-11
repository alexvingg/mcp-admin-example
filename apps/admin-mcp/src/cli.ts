/**
 * Entry point CLI dos comandos interativos do mcp-admin.
 *
 * Subcomandos:
 *   login   - PKCE flow (browser + callback)
 *   logout  - apaga tokens
 *   status  - mostra user logado, permissions, expiry
 */
import { login } from "./auth/login.js";
import { tokenStore, decodeJwtPayload } from "./auth/token-store.js";

const subcommand = process.argv[2];

async function statusCmd() {
  const stored = await tokenStore.load();
  if (!stored) {
    console.log("✗ Not logged in. Run `mcp-admin login` first.");
    process.exit(1);
  }

  const payload = decodeJwtPayload(stored.access_token);
  const expiresAtMs = stored.expires_at;
  const remainingMs = Math.max(0, expiresAtMs - Date.now());
  const remainingMin = Math.floor(remainingMs / 60_000);
  const remainingSec = Math.floor((remainingMs % 60_000) / 1000);
  const expired = remainingMs <= 0;

  const permissions = (payload.permissions as string[] | undefined) ?? [];
  const scope = (payload.scope as string | undefined) ?? "";
  const isAdmin =
    permissions.includes("write:customers") ||
    permissions.includes("delete:customers");

  console.log(`✓ Logged in as ${stored.email ?? "<unknown>"}`);
  console.log(`  sub:           ${stored.sub ?? "<unknown>"}`);
  console.log(`  role:          ${isAdmin ? "admin" : permissions.length ? "user" : "unknown"}`);
  console.log(`  permissions:   ${permissions.length ? permissions.join(", ") : "(none)"}`);
  console.log(`  scope:         ${scope || "(none)"}`);
  console.log(
    `  access_token:  ${expired ? "✗ EXPIRED" : `✓ valid (expires in ${remainingMin}m ${remainingSec}s)`}`,
  );
  console.log(`  tokens file:   ${tokenStore.path()}`);
}

async function logoutCmd() {
  await tokenStore.clear();
  console.log("✓ Logged out. Tokens cleared.");
}

async function main() {
  switch (subcommand) {
    case "login":
      await login();
      break;
    case "logout":
      await logoutCmd();
      break;
    case "status":
      await statusCmd();
      break;
    default:
      console.error("Usage: mcp-admin <login|logout|status>");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("✗ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
