# Auth0 Admin Demo — Fase 1 + ABAC + MCP

MVP local de autenticação e autorização real com **Auth0**, mostrando **RBAC + scopes** + **ABAC por instância** + **MCP server** end-to-end:

- **`apps/admin-web`** — React + Vite + TypeScript + Tailwind + shadcn/ui (responsivo, dark mode)
- **`apps/admin-api`** — Express + TypeScript + Prisma + Postgres
- **`apps/admin-mcp`** — MCP server (Node) com PKCE login pro Claude Code consumir
- **Auth0** (cloud, free tier) — Authorization Code + PKCE, RBAC, runtime grants
- **Docker Compose** — sobe `db + api + web` com 1 comando (MCP roda no host)

**Pattern de ABAC implementado (versão production-grade):** lista pública pra `read:customers`, mas o **detalhe** exige um GRANT em runtime — frontend chama `POST /api/customers/:id/access-request`, backend valida ENTITLEMENT, cria grant com TTL (5 min), e o middleware Tier 2 verifica esse grant em runtime. JWT carrega só identidade (sem bloat). Réplica fiel do pattern Redis-grants do pattern enterprise. Detalhes em [`docs/PATTERN_AUTH0_ACTION.md`](docs/PATTERN_AUTH0_ACTION.md).

---

## Arquitetura

```
┌──────────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│  admin-web (Vite)    │     │   Auth0 Tenant       │     │  admin-api (Express)│
│  React + auth0-react │────▶│  Universal Login     │     │  express-oauth2-    │
│  http://localhost:   │◀────│  (PKCE + Auth Code)  │     │  jwt-bearer         │
│  5173                │     │  Issues access_token │     │  http://localhost:  │
└──────────┬───────────┘     └──────────────────────┘     │  3001               │
           │                                              └─────────┬──────────┘
           │  fetch(api, { Authorization: Bearer <jwt> })           │
           └────────────────────────────────────────────────────────┘
                                                                    │
                                                            ┌───────▼─────────┐
                                                            │ Postgres 16     │
                                                            │ container db    │
                                                            └─────────────────┘
```

**Fluxo:** navegador → Universal Login Auth0 → callback no admin-web com `code` → SDK troca por `access_token` (audience = API) → chamadas REST com `Bearer` → API valida JWS via JWKS, extrai `permissions` e libera/nega.

---

## Pré-requisitos

- **Docker Desktop** (ou Docker Engine + Compose plugin)
- **Conta Auth0 free tier** — [signup](https://auth0.com/signup)
- Node 20+ é opcional (só pra editar fora do container)

---

## 📚 Setup completo — 2 documentos

| Documento | Quando usar |
|---|---|
| [`docs/AUTH0_SETUP.md`](docs/AUTH0_SETUP.md) | **Toda a configuração do tenant Auth0**: SPA admin-web + API admin-api + permissions + RBAC + roles + users + **app Native admin-mcp** (passo 10). Faça uma vez. |
| [`docs/MCP_SETUP.md`](docs/MCP_SETUP.md) | **Cliente MCP + Claude Code**: build, PKCE login no browser, `claude mcp add` com caminhos absolutos, troubleshooting (versão do Node, paths quebrados, ssh keys, etc). |

**Ordem recomendada:**
1. `AUTH0_SETUP.md` (10 min) → cria tenant, apps, permissions, roles, users
2. Subir o stack: `npm run setup && docker compose up --build`
3. `MCP_SETUP.md` (5 min) → login no MCP + registrar no Claude Code

---

## Setup do Auth0 (resumo)

Configuração detalhada com prints e atalhos: [`docs/AUTH0_SETUP.md`](docs/AUTH0_SETUP.md)

Resumo:

1. Criar **SPA Application** `admin-web` no Auth0
2. Criar **Custom API** `admin-api` (Identifier = `https://admin-api.local`, RS256)
3. Adicionar **6 permissions** na API: `read|write|delete : customers|products`
4. Habilitar **RBAC** + **Add Permissions in Access Token** (na aba Settings da API)
5. Criar **roles** `admin` (6 permissions) e `user` (só read:*)
6. Criar **users** `admin@demo.local` e `user@demo.local` e atribuir roles
7. Em **Application Access** da API, autorizar a SPA admin-web a usar todas as 6 permissions

Depois copie 3 valores pros `.env`:
- `AUTH0_DOMAIN` (ex: `dev-xxxxx.us.auth0.com`)
- `VITE_AUTH0_CLIENT_ID` (do app admin-web)
- `AUTH0_AUDIENCE` = `https://admin-api.local`

---

## Subir o projeto

```bash
# 1. Setup inicial (cria .env a partir de .env.example)
npm run setup

# 2. Edite os arquivos .env com os valores reais do Auth0
$EDITOR apps/admin-api/.env
$EDITOR apps/admin-web/.env

# 3. Sobe tudo
docker compose up --build
```

Acesse:
- 🔵 **Frontend:** http://localhost:5173
- 🟢 **Backend health:** http://localhost:3001/api/health
- 🟣 **Postgres:** `localhost:5432` (user: `admin`, password: `admin`, db: `admindb`)

O admin-api roda automaticamente no boot:
- `npx prisma migrate deploy` — aplica migrations
- `npm run db:seed` — popula 5 customers + 5 products
- `npm run dev` — sobe Express com hot-reload

---

## Testar manualmente

1. Abra http://localhost:5173 → clique em **Entrar com Auth0**
2. Faça login com **admin@demo.local** (a senha que você definiu no Auth0)
3. ✅ No Dashboard você deve ver **6 permissions**
4. ✅ Em **Customers** e **Products** você deve ver botão **+ New** e ações **Editar/Excluir**
5. Faça **Logout** (canto superior direito)
6. Entre com **user@demo.local**
7. ✅ Dashboard mostra **2 permissions**
8. ✅ Em Customers/Products **NÃO** aparece "+ New" nem "Editar/Excluir"
9. ✅ Se você tentar via DevTools (`fetch('/api/customers', {method:'POST', ...})`), o backend retorna **403** com toast vermelho.

### Verificação via curl

```bash
# 1. Sem token
curl -i http://localhost:3001/api/customers      # 401

# 2. Com token de admin (copie do localStorage do navegador após login)
TOKEN=eyJhbGciOiJSUzI1NiIs...
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/customers   # 200

# 3. Tentar deletar com token de user
curl -X DELETE -H "Authorization: Bearer $TOKEN_USER" \
  http://localhost:3001/api/customers/<id>  # 403 + JSON com required/granted
```

---

## Tabela de rotas × scopes

Documentado em [`docs/API_ROUTES.md`](docs/API_ROUTES.md). Resumo:

| Método | Rota                                       | Tier 1 (scope)       | Tier 2 (grant)               |
|--------|--------------------------------------------|----------------------|------------------------------|
| GET    | `/api/health`                              | (público)            | —                            |
| GET    | `/api/me`                                  | (autenticado)        | —                            |
| GET    | `/api/customers`                           | `read:customers`     | —                            |
| GET    | `/api/customers/:id`                       | `read:customers`     | **grant ativo** ✅           |
| POST   | `/api/customers/:id/access-request`        | `read:customers`     | (cria grant; entitlement check) |
| GET    | `/api/grants/me`                           | `read:customers`     | —                            |
| POST   | `/api/customers`                           | `write:customers`    | —                            |
| PUT    | `/api/customers/:id`                       | `write:customers`    | —                            |
| DELETE | `/api/customers/:id`                       | `delete:customers`   | —                            |
| GET    | `/api/products`                            | `read:products`      | —                            |
| POST   | `/api/products`                            | `write:products`     | —                            |
| PUT    | `/api/products/:id`                        | `write:products`     | —                            |
| DELETE | `/api/products/:id`                        | `delete:products`    | —                            |
| POST   | `/internal/permissions` *(deprecated)*     | `x-internal-psk`     | (stub — retorna vazio)       |

---

## Estrutura

```
.
├── apps/
│   ├── admin-api/           Express + Prisma + Auth0 JWT
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── config/         env validation
│   │       ├── middleware/     auth + scope guards
│   │       ├── modules/        customers/ + products/ (routes/controller/service/repo)
│   │       └── index.ts        bootstrap
│   └── admin-web/           React + Vite + Tailwind + shadcn
│       └── src/
│           ├── api/            client com bearer + handlers 401/403
│           ├── auth/           usePermissions + ProtectedRoute
│           ├── components/ui/  shadcn/ui (Button, Card, Table, Toast, Dialog…)
│           ├── layout/         AdminLayout (sidebar + topbar responsivo)
│           ├── pages/          Login, Dashboard, Customers*, Products*, Forbidden
│           └── main.tsx        Auth0Provider + QueryClient + Router
├── docker-compose.yml
├── docs/
│   ├── AUTH0_SETUP.md       passo a passo do Auth0
│   ├── API_ROUTES.md        tabela de rotas
│   └── JWT_EXAMPLES.md      payloads esperados
└── scripts/
    ├── setup.sh             primeiro setup
    └── dev.sh               atalho pra docker compose up --build
```

---

## Comandos úteis

```bash
npm run dev              # docker compose up --build
npm run down             # docker compose down
npm run down:v           # down + remove volumes (apaga dados Postgres!)
npm run logs             # logs de todos os containers
npm run logs:api         # só admin-api
npm run logs:web         # só admin-web
npm run shell:api        # shell dentro do container admin-api
npm run shell:db         # psql no Postgres
```

Dentro do container admin-api:
```bash
npm run db:migrate:dev   # cria nova migration interativa
npm run db:seed          # repopula seed
npm run db:studio        # Prisma Studio (web UI do Postgres)
```

---

## Decisões e simplificações de MVP

- **Permission gating no frontend é só UX.** Aplicado no menu lateral e em 1-2 pontos por página, não em todo botão. **Backend é a fonte da verdade.**
- **Postgres em container** em vez de SQLite — mais próximo de produção, pequeno overhead.
- **Password Grant ROPG** foi habilitado **só pra teste inicial via curl** — desabilite depois em Applications → admin-web → Settings → Advanced → Grant Types.
- **Sem refresh tokens** — `cacheLocation: "localstorage"` do Auth0 cacheia o access_token; quando expira, o SDK tenta `getAccessTokenSilently` (silent renew via cookie de sessão Auth0).

## ABAC por instância (Runtime Grants — pattern pattern enterprise)

`GET /api/customers/:id` exige um **grant ativo** no backend (não no JWT!). Fluxo:

1. Frontend → `POST /api/customers/:id/access-request`
2. Backend valida ENTITLEMENT (`alex pode acessar Maria?`)
   - Se entitled → cria grant com TTL 5min e responde 201
   - Se não → 403 `no_entitlement`
3. Frontend → `GET /api/customers/:id`
4. Middleware Tier 2 verifica grant ativo no `grantStore`
   - Encontrou → 200 + payload
   - Não encontrou → 403 `no_active_grant`

Admin (`write:customers`) bypassa entitlement E grant check.

### Por que esse pattern em vez de "tudo no JWT"?

- ✅ **JWT enxuto** — escala pra milhares de relações user×customer
- ✅ **Mudança imediata** — revogar entitlement reflete na próxima request
- ✅ **Audit forte** — cada grant gera log com `granted_at`/`expires_at`
- ✅ **Suporta TTL nativo** — grants auto-expiram (em prod: Redis TTL)

A versão anterior usando Auth0 Action + custom claim tem limites (JWT bloat, latência no login, stale data). Mantida como apêndice histórico no doc.

### Não precisa configurar Auth0 Action

A versão atual **não depende** de ngrok / Auth0 Action / endpoint interno. Tudo runtime no backend. Se você já configurou a Action antes (versão 1), pode desabilitar/remover sem impacto.

Anatomia completa, comparativo lado-a-lado com pattern enterprise (Redis 10s TTL), e roadmap de evolução em [`docs/PATTERN_AUTH0_ACTION.md`](docs/PATTERN_AUTH0_ACTION.md).

---

## MCP Server (Claude Code integration)

`apps/admin-mcp` expõe as mesmas operações da admin-web como **tools** consumíveis pelo Claude Code (ou qualquer cliente MCP). Autentica via Auth0 com **PKCE + callback localhost** — você roda `npm run mcp:login` uma vez, ele abre o browser, salva tokens, e Claude pode usar todas as tools respeitando o seu perfil.

### Tools expostas (11)

```
whoami
list_customers, get_customer, create_customer, update_customer, delete_customer
list_products,  get_product,  create_product,  update_product,  delete_product
```

A **autorização é toda no backend** — admin pode tudo, user só lê + entitled customers. O MCP é só passa-bandeja.

### Setup rápido

```bash
# 1. Cria app Native no Auth0 (~5 min — passos em apps/admin-mcp/README.md)
# 2. Preenche apps/admin-mcp/.env com o MCP_CLIENT_ID

# 3. Build + login (abre browser)
npm run mcp:login
# → "✓ Logged in as user@demo.local"

# 4. Configura Claude Code (~/.claude/claude_desktop_config.json)
#    veja apps/admin-mcp/README.md
```

### Comandos

```bash
npm run mcp:login    # PKCE flow, salva tokens
npm run mcp:status   # quem tá logado, permissions, expiry
npm run mcp:logout   # apaga tokens
npm run mcp:server   # roda manualmente o servidor stdio (debug)
npm run mcp:build    # compila TypeScript
```

Setup completo, integração com Claude Code, troubleshooting em [`apps/admin-mcp/README.md`](apps/admin-mcp/README.md).

---

## Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| Login redireciona pra `?error=callback URL mismatch` | Allowed Callback URLs não bate | Adicione `http://localhost:5173` E `http://localhost:5173/` (com e sem barra) |
| `permissions: []` no JWT | RBAC ou "Add Permissions in Access Token" desligados | Auth0 → APIs → admin-api → Settings → RBAC Settings → liga ambos |
| `unauthorized_client` ao pedir token | App não autorizado pra essa API | Auth0 → APIs → admin-api → Application Access → autorize a SPA |
| Frontend mostra `Sessão expirada` em loop | Token vencido + silent renew falhando | Verifique se `Allowed Web Origins` inclui `http://localhost:5173` |
| `ECONNREFUSED db:5432` no boot | Container db ainda subindo | Healthcheck cuida disso, mas pode tentar `docker compose restart admin-api` |

---

## Licença

MIT — projeto demo, use à vontade.
