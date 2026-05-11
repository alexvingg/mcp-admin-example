# admin-mcp

MCP server que expõe as operações de `admin-api` como tools pro Claude Code (ou outro cliente MCP). Autentica via Auth0 com **Authorization Code + PKCE** com callback em `localhost:8765`.

## Anatomia

```
Terminal:                              Claude Code (background):
  $ npm run mcp:login                    spawns: node dist/server.js
       ↓                                       ↑
       PKCE flow no browser                    │ stdio (JSON-RPC MCP protocol)
       ↓                                       │
       Auth0 redireciona pra                   │
       http://localhost:8765/callback          │
       ↓                                       │
       MCP captura code → troca por tokens     │
       ↓                                       │
       Salva tokens em                         │
       ~/.config/auth0-admin-mcp/tokens.json   │
                                               │
       (próximas execuções refrescam            │
        automaticamente quando perto             │
        de expirar)                              │
                                               ▼
                                   Tools chamam admin-api com Bearer
                                   admin-api faz a autorização real
                                   (RBAC + entitlements + grants)
```

## Pré-requisitos

1. `admin-api` rodando (`docker compose up`) em `http://localhost:3001`
2. App Auth0 **Native** criado (separado da SPA `admin-web`) — veja "Setup Auth0" abaixo
3. Node 20+ no host

## Setup Auth0 (uma vez)

### 1. Criar a application Native

Auth0 dashboard → **Applications → Applications → + Create Application**:
- Name: `admin-mcp`
- Type: **Native**

### 2. Settings da application

- **Allowed Callback URLs:** `http://localhost:8765/callback`
- **Allowed Logout URLs:** `http://localhost:8765`
- **Token Endpoint Authentication Method:** `None` (PKCE não usa client_secret)

### 3. Advanced Settings → Grant Types

Marcar:
- ✅ **Authorization Code**
- ✅ **Refresh Token**

(Authorization Code é o default; Refresh Token você ativa pra ter offline access.)

### 4. Refresh Token Rotation (recomendado)

Em Settings → role até **Refresh Token Rotation**:
- ✅ **Rotation: ON**
- **Reuse Interval:** 0 (default)
- **Absolute Lifetime:** 30 dias

### 5. Autorizar na API

APIs → admin-api → **Application Access** → autoriza `admin-mcp` → marca **todas as 6 permissions** → Save.

### 6. Anotar Client ID

Em Settings → **Basic Information** → **Client ID** — cole em `apps/admin-mcp/.env`:

```
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://admin-api.local
MCP_CLIENT_ID=<o Client ID do app Native que você acabou de criar>
API_BASE_URL=http://localhost:3001
PKCE_CALLBACK_PORT=8765
```

## Uso

```bash
# Build (1ª vez, ou quando alterar código)
npm run mcp:build

# Login (abre browser)
npm run mcp:login
# → "✓ Logged in as user@demo.local"
# → tokens salvos em ~/.config/auth0-admin-mcp/tokens.json (mode 0600)

# Conferir status
npm run mcp:status
# → "Logged in as user@demo.local"
#   "role: user"
#   "permissions: read:customers, read:products"
#   "access_token: ✓ valid (expires in 23h 58m)"

# Logout
npm run mcp:logout
```

## Tools expostas

| Tool | API chamada | Quem pode |
|---|---|---|
| `whoami` | `GET /api/me` | qualquer logado |
| `list_customers` | `GET /api/customers` | qualquer logado com `read:customers` |
| `get_customer(id)` | `POST /access-request` + `GET /:id` | logado + entitlement (admin bypassa) |
| `create_customer({name, email, status?})` | `POST /api/customers` | admin only |
| `update_customer(id, {...})` | `PUT /api/customers/:id` | admin only |
| `delete_customer(id)` | `DELETE /api/customers/:id` | admin only |
| `list_products` | `GET /api/products` | logado com `read:products` |
| `get_product(id)` | `GET /api/products/:id` | logado com `read:products` |
| `create_product({name, price, status?})` | `POST /api/products` | admin only |
| `update_product(id, {...})` | `PUT /api/products/:id` | admin only |
| `delete_product(id)` | `DELETE /api/products/:id` | admin only |

> **A autorização é toda no backend.** O MCP é só "passa-bandeja" — se o user não pode, o backend responde 403 e o MCP propaga pro Claude.

## Integração com Claude Code

Edite o config (Claude Code procura em `~/.claude/claude_desktop_config.json` no Mac, ou via `claude mcp add`):

```json
{
  "mcpServers": {
    "admin-mcp": {
      "command": "node",
      "args": ["/Users/alex/Documents/projetos/auth0_project_mcp/apps/admin-mcp/dist/server.js"],
      "env": {
        "AUTH0_DOMAIN": "your-tenant.us.auth0.com",
        "AUTH0_AUDIENCE": "https://admin-api.local",
        "MCP_CLIENT_ID": "<o Client ID do app Native>",
        "API_BASE_URL": "http://localhost:3001",
        "PKCE_CALLBACK_PORT": "8765"
      }
    }
  }
}
```

> O caminho em `args` precisa ser **absoluto** até o `dist/server.js` compilado.

Ou via CLI do Claude Code:

```bash
claude mcp add admin-mcp \
  --command "node" \
  --args "/Users/alex/Documents/projetos/auth0_project_mcp/apps/admin-mcp/dist/server.js" \
  --env AUTH0_DOMAIN=your-tenant.us.auth0.com \
  --env AUTH0_AUDIENCE=https://admin-api.local \
  --env MCP_CLIENT_ID=<seu-client-id> \
  --env API_BASE_URL=http://localhost:3001 \
  --env PKCE_CALLBACK_PORT=8765
```

Depois reinicie o Claude Code. Pra testar:

> "Use o admin-mcp pra listar todos os customers"
> "Mostra o detalhe do customer cmow1yxwx0000..."
> "Cria um customer Foo com email foo@example.com"

## Smoke test (sem Claude Code)

Roda direto via stdio pra ver se as tools tão registradas:

```bash
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}'
  sleep 0.3
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  sleep 1
} | node apps/admin-mcp/dist/server.js
```

Esperado: 11 tools no array de retorno.

## Troubleshooting

| Problema | Causa | Fix |
|---|---|---|
| `Not logged in` | Tokens não salvos | `npm run mcp:login` |
| `MCP config inválida: MCP_CLIENT_ID` | `.env` não preenchido | Edita `apps/admin-mcp/.env` com Client ID do app Native |
| `Refresh token failed: 403` | Refresh token expirou (>30 dias ou foi rotacionado) | `npm run mcp:logout && npm run mcp:login` |
| `EADDRINUSE :8765` | Porta ocupada | Mude `PKCE_CALLBACK_PORT` no `.env` E nos Allowed Callback URLs do Auth0 |
| Browser não abre | sem display, ssh, etc | Copie a URL impressa no terminal e cola manualmente |
| `API error 403: no_active_grant` no `get_customer` | Grant flow falhou silenciosamente — provavelmente token expirou entre o POST e o GET | Tenta de novo |
| `API error 403: no_entitlement` | User não tem direito pro customer | Use `whoami` pra confirmar que tá logado como o user esperado |
| Claude Code não vê o MCP | Config não recarregada | Reinicia o Claude Code |

## Arquivos

```
apps/admin-mcp/
├── bin/mcp-admin.js              dispatcher CLI (login/logout/status/server)
└── src/
    ├── config.ts                 validação Zod das env vars
    ├── auth/
    │   ├── pkce.ts               code_verifier + challenge
    │   ├── login.ts              fluxo PKCE (browser + http callback server)
    │   ├── refresh.ts            POST /oauth/token grant=refresh_token
    │   ├── token-store.ts        ~/.config/auth0-admin-mcp/tokens.json (0600)
    │   └── index.ts              getValidAccessToken() público
    ├── api/client.ts             fetch wrapper com Bearer + ApiError
    ├── tools/
    │   ├── customers.ts          5 tools (com grant flow no get)
    │   ├── products.ts           5 tools (RBAC puro)
    │   ├── identity.ts           whoami
    │   └── index.ts              agregador
    ├── cli.ts                    comandos login/logout/status
    └── server.ts                 MCP stdio server
```
