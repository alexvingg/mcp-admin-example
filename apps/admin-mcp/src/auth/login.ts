/**
 * Fluxo PKCE end-to-end:
 *   1. Gera verifier/challenge
 *   2. Sobe http server local na PKCE_CALLBACK_PORT
 *   3. Abre o /authorize do Auth0 no browser do usuário
 *   4. Aguarda redirect /callback?code=...&state=...
 *   5. Troca code por tokens
 *   6. Persiste em disco
 */
import { createServer, type Server } from "node:http";
import open from "open";
import { env } from "../config.js";
import { generatePkce, randomState } from "./pkce.js";
import { tokenStore, decodeJwtPayload } from "./token-store.js";

const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access", // necessário pra Auth0 emitir refresh_token
  "read:customers",
  "write:customers",
  "delete:customers",
  "read:products",
  "write:products",
  "delete:products",
].join(" ");

interface AuthorizationCallback {
  code: string;
  state: string;
}

function waitForCallback(port: number, expectedState: string): Promise<AuthorizationCallback> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? "", `http://localhost:${port}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>Login error</h1><pre>${error}: ${url.searchParams.get("error_description")}</pre>`);
        server.close();
        return reject(new Error(`Auth0 returned error: ${error}`));
      }

      if (!code || !state) {
        res.writeHead(400).end("Missing code or state");
        server.close();
        return reject(new Error("Missing code or state in callback"));
      }

      if (state !== expectedState) {
        res.writeHead(400).end("Invalid state");
        server.close();
        return reject(new Error("State mismatch (possible CSRF)"));
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <head><title>Login successful</title></head>
          <body style="font-family: system-ui; padding: 3rem; text-align: center;">
            <h1>✓ Login successful</h1>
            <p>You can close this window and return to your terminal.</p>
            <script>setTimeout(() => window.close(), 1500)</script>
          </body>
        </html>
      `);
      server.close();
      resolve({ code, state });
    });

    server.on("error", reject);
    server.listen(port);
  });
}

export async function login(): Promise<void> {
  const port = env.PKCE_CALLBACK_PORT;
  const redirectUri = `http://localhost:${port}/callback`;

  const { verifier, challenge } = generatePkce();
  const state = randomState();

  const authUrl = `https://${env.AUTH0_DOMAIN}/authorize?` + new URLSearchParams({
    client_id: env.MCP_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    audience: env.AUTH0_AUDIENCE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  console.log("→ Abrindo browser pra login Auth0…");
  console.log(`  Se o browser não abrir, acesse manualmente:\n  ${authUrl}\n`);

  // Em paralelo: abre browser + aguarda callback
  const callbackPromise = waitForCallback(port, state);
  await open(authUrl);

  const { code } = await callbackPromise;

  console.log("→ Trocando code por tokens…");

  const tokenRes = await fetch(`https://${env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.MCP_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    throw new Error(`Token exchange failed: ${tokenRes.status} ${body}`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
  };

  // Decoda id_token só pra capturar email/sub (display)
  const idPayload = tokens.id_token ? decodeJwtPayload(tokens.id_token) : {};
  const sub = (idPayload.sub as string | undefined) ?? "unknown";
  const email = (idPayload.email as string | undefined) ?? "unknown";

  await tokenStore.save({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    id_token: tokens.id_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    sub,
    email,
  });

  console.log(`✓ Logged in as ${email}`);
  console.log(`  sub: ${sub}`);
  console.log(`  tokens salvos em ${tokenStore.path()}`);
}
