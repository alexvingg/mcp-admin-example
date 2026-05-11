# MCP Setup — `apps/admin-mcp` + Claude Code

Guia completo pra configurar o MCP server e conectar ao Claude Code. Você sai daqui com tools do admin-api utilizáveis direto via chat com Claude.

Pré-requisitos:
- `admin-api` rodando em `http://localhost:3001` (subir com `docker compose up`)
- Tenant Auth0 configurado conforme [`AUTH0_SETUP.md`](AUTH0_SETUP.md), incluindo o **app Native `admin-mcp`** (passo 10)
- Node 18+ disponível (recomendado: Node 20 ou 22)
- Claude Code CLI instalado (`claude` no PATH)

---

## 1. Configurar `.env` do MCP

Copia o template e preenche:

```bash
cd apps/admin-mcp
cp .env.example .env
```

Edita `apps/admin-mcp/.env`:

```
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://admin-api.local
MCP_CLIENT_ID=<client-id-do-app-native-admin-mcp>
API_BASE_URL=http://localhost:3001
PKCE_CALLBACK_PORT=8765
```

> O `MCP_CLIENT_ID` é o que você anotou no passo 10 do `AUTH0_SETUP.md` (Client ID do app Native, não da SPA).

---

## 2. Build do MCP

Na raiz do monorepo:

```bash
npm install              # se ainda não rodou
npm run mcp:build        # compila TS → apps/admin-mcp/dist/
```

Verifica que compilou:
```bash
ls apps/admin-mcp/dist/server.js apps/admin-mcp/dist/cli.js
```

Se erro de Node version, **veja seção [Troubleshooting → Node version](#node-version-causando-erro)** abaixo.

---

## 3. Login no Auth0 via PKCE

Da raiz do monorepo:

```bash
npm run mcp:login
```

O que acontece:

```
1. MCP gera PKCE pair (code_verifier + code_challenge)
2. Sobe http server local em :8765 (rota /callback)
3. Abre browser na URL https://<tenant>.auth0.com/authorize?...
4. Você loga no Universal Login (admin@demo.local ou user@demo.local)
5. Auth0 redireciona pra http://localhost:8765/callback?code=...
6. MCP captura o code → troca por tokens
7. Salva em ~/.config/auth0-admin-mcp/tokens.json (mode 0600)
8. Browser mostra "Login successful, you can close this window"
9. Terminal mostra "✓ Logged in as user@demo.local"
```

Se algo travar, veja [Troubleshooting](#troubleshooting).

### Verifica status

```bash
npm run mcp:status
```

Output esperado:
```
✓ Logged in as user@demo.local
  sub:           auth0|abc123...
  role:          user
  permissions:   read:customers, read:products
  scope:         openid profile email read:customers read:products
  access_token:  ✓ valid (expires in 23h 59m)
  tokens file:   /Users/<you>/.config/auth0-admin-mcp/tokens.json
```

### Trocar de perfil

Pra testar como admin:
```bash
npm run mcp:logout    # apaga tokens
npm run mcp:login     # entra de novo (escolhe admin@demo.local no Universal Login)
```

---

## 4. Adicionar o MCP ao Claude Code

Use `claude mcp add` com **caminhos absolutos** (Claude Code não tem nvm/PATH carregado quando spawna child processes — usar caminho relativo `node` quebra).

### 4.1 Descobrir o caminho do Node que vai funcionar

```bash
# Use a versão do Node que compilou o projeto
which node
# ex: /Users/alex/.nvm/versions/node/v20.19.0/bin/node

# Se você usa nvm, force uma versão específica:
nvm use 20
which node
```

Anote o resultado — vai ser usado abaixo.

### 4.2 Comando `claude mcp add`

**Em UMA ÚNICA linha** (não use `\` pra quebrar — copy/paste tudo de uma vez):

```bash
claude mcp add --transport stdio --scope user admin-mcp -- /Users/<you>/.nvm/versions/node/v20.19.0/bin/node /<caminho-absoluto-do-projeto>/apps/admin-mcp/dist/server.js
```

Substituições:
- `/Users/<you>/.nvm/versions/node/v20.19.0/bin/node` → seu `which node`
- `/<caminho-absoluto-do-projeto>` → onde clonou o repo

Exemplo concreto:
```bash
claude mcp add --transport stdio --scope user admin-mcp -- /Users/alex/.nvm/versions/node/v20.19.0/bin/node /Users/alex/Documents/projetos/auth0_project_mcp/apps/admin-mcp/dist/server.js
```

### Sobre os flags

| Flag | O que faz |
|---|---|
| `--transport stdio` | MCP usa stdin/stdout (padrão pra MCP local — Claude spawna o processo) |
| `--scope user` | Disponível em qualquer projeto seu, salvo em `~/.claude.json`. Alternativas: `--scope local` (só esse projeto) ou `--scope project` (`.mcp.json` no repo, compartilhado via git) |
| `admin-mcp` | Nome que vai aparecer em `/mcp` e usado pra identificar |
| `--` | Separa flags do Claude do comando que vai rodar |
| `<caminho-node> <caminho-server.js>` | Comando + arg pra rodar o MCP |

### 4.3 Verificar que adicionou

```bash
claude mcp list
```

Esperado:
```
admin-mcp: /Users/.../node /Users/.../dist/server.js
```

Detalhes:
```bash
claude mcp get admin-mcp
```

---

## 5. Recarregar e testar dentro do Claude Code

Abre o Claude Code (ou se já tá aberto):

```
/reload-plugins
```

Pra ver o status:
```
/mcp
```

Esperado: `admin-mcp · ✓ ready` com **11 tools** disponíveis.

### Smoke tests no chat

Cola esses prompts no Claude Code:

**Identidade:**
> "Use a ferramenta whoami do admin-mcp pra me dizer quem está logado."

Esperado: retorna `sub`, `role`, `permissions`.

**Lista (sempre funciona pra quem tem `read:customers`):**
> "Liste todos os customers usando admin-mcp."

Esperado: 5 customers do seed.

**Detalhe com entitlement (admin sempre passa; user passa se entitled):**
> "Mostra o detalhe do customer cmow1yxwx0000p86ii31r8vcx via admin-mcp."

Esperado:
- Admin → 200 com payload completo
- User entitled → 200 (Tier 2 grant flow é transparente)
- User NÃO entitled → 403 `no_entitlement`

**Escrita (admin only):**
> "Cria um customer Foo com email foo@example.com via admin-mcp."

Esperado:
- Admin → 201
- User → 403 `insufficient_scope`

---

## Troubleshooting

### `admin-mcp · ✘ failed` no `/mcp`

Causa mais comum: o `node` no PATH do Claude Code está numa versão antiga (8 / 10 / 12) que não suporta ESM moderno ou top-level await.

Diagnóstico:
```bash
# Vê o config que tá salvo
cat ~/.claude.json | python3 -c "import sys, json; print(json.dumps([s for s in json.load(sys.stdin).get('mcpServers',{}).values()], indent=2))"

# Vê o erro real (rodando manualmente)
node /caminho/dist/server.js  # se der "Unexpected token", versão muito velha
```

Fix: refazer `claude mcp add` com **caminho absoluto** pro Node 18+ (não use `node` solto). Veja seção [4.2](#42-comando-claude-mcp-add).

### `Cannot find module .../dist/ ` (com espaço no path)

Aconteceu se você usou `\` pra quebrar linha no `claude mcp add` e o shell preservou um espaço. Solução: rode `claude mcp remove admin-mcp` e re-adicione **tudo numa única linha**.

### `Not logged in. Run mcp-admin login first.`

Os tokens não foram persistidos ou foram apagados. Rode:
```bash
npm run mcp:login
```

### `MCP config inválida: MCP_CLIENT_ID parece inválido`

O `.env` do MCP não foi preenchido com o Client ID real (deixou o placeholder). Edita `apps/admin-mcp/.env` e preenche `MCP_CLIENT_ID` com o valor do Auth0 dashboard (passo 10 do `AUTH0_SETUP.md`).

### `EADDRINUSE :8765` no login

A porta 8765 tá ocupada (outro processo usando). Opções:

1. Mata o processo:
   ```bash
   lsof -ti:8765 | xargs kill
   ```
2. Ou muda a porta — edita `PKCE_CALLBACK_PORT` em `apps/admin-mcp/.env` E adiciona a nova URL nos **Allowed Callback URLs** do Auth0 Native app.

### Browser não abre no `mcp:login`

Acontece em ambientes SSH/headless. A URL completa é impressa no terminal — copia e cola manualmente em qualquer browser. Faça login, o callback redireciona pra `localhost:8765` mesmo (precisa estar na mesma máquina, ou usar port forward SSH).

### `Refresh token failed: 403`

Refresh token expirou (>30 dias por default) ou foi rotacionado e o local ficou stale.
```bash
npm run mcp:logout
npm run mcp:login
```

### Login funciona, mas `get_customer` dá 403 `no_active_grant`

Isso é parte do design — o grant flow precisa do POST `/access-request` antes do GET. O MCP faz isso automaticamente na tool `get_customer`. Se ainda dá 403, provavelmente o user não tem entitlement pro id pedido (use `whoami` pra ver quem tá logado).

### `API error 403: no_entitlement`

User logado não tem direito pro customer requisitado. Comportamento esperado pra non-admin acessar customer fora do `customerEntitlementsStore`. Pra liberar: edite o seed em `apps/admin-api/src/index.ts` ou logue como admin.

### Node version causando erro

Múltiplas versões de Node coexistem com nvm. Pra forçar uma versão específica no `claude mcp add`, sempre use **caminho absoluto** ao binário do Node 18+. Localizar:

```bash
ls -la /Users/<you>/.nvm/versions/node/
# Mostra todas as versões instaladas

ls /Users/<you>/.nvm/versions/node/v20*/bin/node
# Caminho absoluto do Node 20
```

### `claude --debug` pra ver erro detalhado

Se nada acima resolveu:
```bash
claude --debug
```

Procura no log por linhas começando com `[admin-mcp]` ou `error` perto da inicialização.

---

## Operação dia-a-dia

```bash
# Status de quem tá logado
npm run mcp:status

# Trocar de perfil (admin ↔ user)
npm run mcp:logout && npm run mcp:login

# Recompilar depois de mudar código do MCP
npm run mcp:build
# Depois, no Claude Code: /reload-plugins

# Smoke test sem Claude Code (stdio direto)
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.1"}}}'
  sleep 0.3
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  sleep 1
} | node apps/admin-mcp/dist/server.js
# Esperado: array com 11 tools

# Remover MCP do Claude Code
claude mcp remove admin-mcp
```

---

## Arquivos relevantes

| Path | O quê |
|---|---|
| `apps/admin-mcp/src/auth/login.ts` | Fluxo PKCE (browser + http callback) |
| `apps/admin-mcp/src/auth/refresh.ts` | POST `/oauth/token` com `grant_type=refresh_token` |
| `apps/admin-mcp/src/auth/token-store.ts` | Persistência em `~/.config/auth0-admin-mcp/tokens.json` |
| `apps/admin-mcp/src/server.ts` | MCP server (stdio transport) |
| `apps/admin-mcp/src/tools/customers.ts` | 5 tools com grant flow no `get_customer` |
| `apps/admin-mcp/src/tools/products.ts` | 5 tools RBAC puro |
| `apps/admin-mcp/src/tools/identity.ts` | `whoami` |
| `~/.claude.json` | Config do Claude Code (onde `admin-mcp` foi adicionado via `claude mcp add`) |
| `~/.config/auth0-admin-mcp/tokens.json` | Refresh + access token (mode 0600) |

---

## Como o ciclo todo se encaixa

```
┌─────────────────────────────────────────────────────────────────┐
│  Terminal (uma vez)                                             │
│    $ npm run mcp:login                                          │
│           ↓                                                     │
│       PKCE flow no browser → tokens salvos no disco             │
│           ↓                                                     │
│    $ claude mcp add ... admin-mcp -- node /path/server.js       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ (depois)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code (chat)                                             │
│    user: "list customers via admin-mcp"                         │
│           ↓                                                     │
│       Claude detecta tool list_customers no admin-mcp           │
│           ↓                                                     │
│       Spawna: node /path/dist/server.js (child via stdio)       │
│           ↓                                                     │
│       admin-mcp lê tokens do disco                              │
│           ↓                                                     │
│       refresh transparente se token tá perto de expirar         │
│           ↓                                                     │
│       fetch http://localhost:3001/api/customers                 │
│         Authorization: Bearer <access_token>                    │
│           ↓                                                     │
│       admin-api valida JWT (Tier 1: scope) + responde 200       │
│           ↓                                                     │
│       admin-mcp formata resposta em texto MCP                   │
│           ↓                                                     │
│       Claude apresenta o resultado pro usuário                  │
└─────────────────────────────────────────────────────────────────┘
```

Cada parte (login, build, registro, runtime) é independente — você pode atualizar uma sem mexer nas outras.

---

## Recap

- ✅ Auth0 configurado (veja [`AUTH0_SETUP.md`](AUTH0_SETUP.md) — incluindo o app Native admin-mcp no passo 10)
- ✅ `.env` do MCP preenchido com `MCP_CLIENT_ID`
- ✅ `npm run mcp:build` compila o TypeScript
- ✅ `npm run mcp:login` faz PKCE flow no browser e salva tokens
- ✅ `claude mcp add --scope user admin-mcp -- <node-absoluto> <server.js-absoluto>` registra no Claude Code
- ✅ `/reload-plugins` recarrega no chat ativo
- ✅ `/mcp` confirma `admin-mcp · ✓ ready`
- ✅ Tools disponíveis: `whoami`, `list_customers`, `get_customer`, `create_customer`, `update_customer`, `delete_customer`, `list_products`, `get_product`, `create_product`, `update_product`, `delete_product`

Pronto, é só usar!
