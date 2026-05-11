# Auth0 — Setup passo a passo

Este guia cobre **todo o setup do tenant Auth0** para esta demo. Tempo estimado: **10–15 min**.

---

## 0. Crie um tenant (se ainda não tem)

1. [auth0.com/signup](https://auth0.com/signup) — não precisa de cartão de crédito.
2. Escolha região (ex: US-5).
3. Anote o **domain** do tenant (ex: `your-tenant.us.auth0.com`). Vai usar várias vezes.

---

## 1. Criar a SPA `admin-web`

1. **Applications → Applications → + Create Application**
2. Name: `admin-web`
3. Type: **Single Page Web Application**
4. Technology: **React** (apenas pra mostrar quickstart, não trava nada)
5. Skip o quickstart — vamos para Settings.

### Configurar URLs (em Settings)

Role até **Application URIs** e preencha **com vírgula entre cada par** (com e sem barra final):

| Campo | Valor |
|---|---|
| **Allowed Callback URLs** | `http://localhost:5173, http://localhost:5173/` |
| **Allowed Logout URLs**   | `http://localhost:5173, http://localhost:5173/` |
| **Allowed Web Origins**   | `http://localhost:5173, http://localhost:5173/` |
| **Allowed Origins (CORS)** | (deixe vazio) |

**⚠️ Save Changes** no fim da página.

### Anote os valores

Em **Settings → Basic Information**:

| Variável de ambiente | De onde |
|---|---|
| `VITE_AUTH0_CLIENT_ID` | campo "Client ID" |
| `AUTH0_DOMAIN` / `VITE_AUTH0_DOMAIN` | campo "Domain" |
| `AUTH0_ISSUER_BASE_URL` | `https://<DOMAIN>/` (com barra no fim) |

> ❌ **Ignore o Client Secret** — SPA com PKCE não usa.

---

## 2. Criar a API `admin-api`

1. **Applications → APIs → + Create API**
2. Preencha:

| Campo | Valor |
|---|---|
| **Name** | `admin-api` |
| **Identifier** | `https://admin-api.local` ⚠️ vira o `audience` — não muda depois |
| **JWT Profile** | Auth0 (default) |
| **JWT Signing Algorithm** | **RS256** ⚠️ obrigatório (HS256 não funciona com SPA) |

3. Em **Access Policy for Applications**:
   - **Within user-delegated access** → escolha **"All apps allowed"** (simplifica) **OU** mantenha "Per-app authorization" e depois autorize a SPA explicitamente em Application Access (mais seguro).
   - **Within client access** → mantenha "Per-app authorization" (não temos M2M ainda).

4. **Create**.

### Anote

| Variável | Valor |
|---|---|
| `AUTH0_AUDIENCE` / `VITE_AUTH0_AUDIENCE` | `https://admin-api.local` |

---

## 3. Adicionar Permissions

Na página da API recém criada → aba **Permissions** → adicione 6 permissions, **uma por uma**:

| Permission (Scope) | Description |
|---|---|
| `read:customers`   | Read customers |
| `write:customers`  | Create/update customers |
| `delete:customers` | Delete customers |
| `read:products`    | Read products |
| `write:products`   | Create/update products |
| `delete:products`  | Delete products |

⚠️ Use **exatamente** esses nomes — typo aqui = falha em produção.

---

## 4. Habilitar RBAC

Aba **Settings** da API → role até **RBAC Settings** → ligue os 2 toggles:

- ✅ **Enable RBAC**
- ✅ **Add Permissions in the Access Token**

> Sem isso, o JWT vem **sem o array `permissions`** e o backend não consegue autorizar nada.

**Save Changes** no fim.

---

## 5. Autorizar a SPA na API (se você escolheu "Per-app authorization")

API → aba **Application Access**

1. Encontre a linha do `admin-web` (Client ID que você anotou)
2. Clique em **Edit**
3. Em **User-delegated access**, marque **TODAS as 6 permissions**
4. **Save**

> Isso autoriza a SPA a **pedir** essas permissions. Quem é entregue de fato no token depende do role do usuário (próximo passo).

---

## 6. Criar Roles

1. **User Management → Roles → + Create Role**

### Role `admin`

- Name: `admin`
- Description: `Full access — read/write/delete customers and products`
- **Create** → aba **Permissions → Add Permissions**
- Selecione a API `admin-api` no dropdown
- ✅ Marque **TODAS as 6 permissions**
- **Add Permissions**

### Role `user`

- Volta em Roles → **+ Create Role**
- Name: `user`
- Description: `Read-only access`
- **Create** → aba **Permissions → Add Permissions** → `admin-api`
- ✅ Marque **APENAS** `read:customers` e `read:products`
- **Add Permissions**

---

## 7. Criar Users de teste

**User Management → Users → + Create User**

### admin@demo.local

| Campo | Valor |
|---|---|
| Email | `admin@demo.local` |
| Password | senha forte (anote! ex: `Admin@DemoPass123!`) |
| Connection | `Username-Password-Authentication` (default) |

**Create** → aba **Roles → Assign Roles** → marque **admin** → **Assign**.

### user@demo.local

Mesmo processo:

| Campo | Valor |
|---|---|
| Email | `user@demo.local` |
| Password | senha forte |
| Connection | `Username-Password-Authentication` |

**Create** → aba **Roles → Assign Roles** → marque **user** → **Assign**.

> 💡 A aba **Permissions** dos users fica **vazia** mesmo após atribuir role — é normal! Permissions herdadas via role aparecem só na aba Roles. O JWT no login resolve as duas fontes.

---

## 8. Preencher os `.env`

Edite os arquivos:

**`apps/admin-api/.env`**
```
PORT=3001
AUTH0_DOMAIN=<seu-tenant>.us.auth0.com
AUTH0_AUDIENCE=https://admin-api.local
AUTH0_ISSUER_BASE_URL=https://<seu-tenant>.us.auth0.com/
DATABASE_URL=postgresql://admin:admin@db:5432/admindb?schema=public
CORS_ORIGIN=http://localhost:5173
```

**`apps/admin-web/.env`**
```
VITE_AUTH0_DOMAIN=<seu-tenant>.us.auth0.com
VITE_AUTH0_CLIENT_ID=<client-id-da-spa>
VITE_AUTH0_AUDIENCE=https://admin-api.local
VITE_API_BASE_URL=http://localhost:3001
```

---

## 9. Subir e testar

```bash
docker compose up --build
```

Abra http://localhost:5173 → **Entrar com Auth0** → use uma das credenciais que você criou.

---

## (Opcional) Validar com curl antes de subir os apps

Permite confirmar a configuração do Auth0 sem precisar do frontend rodando.

### Habilite Password Grant temporariamente

1. Applications → admin-web → Settings → role até **Advanced Settings → Grant Types**
2. ✅ Marque **Password**
3. **Save Changes**

### Faça a request

```bash
curl --request POST \
  --url 'https://<seu-tenant>.us.auth0.com/oauth/token' \
  --header 'content-type: application/json' \
  --data '{
    "grant_type": "http://auth0.com/oauth/grant-type/password-realm",
    "username": "admin@demo.local",
    "password": "<sua-senha>",
    "audience": "https://admin-api.local",
    "scope": "openid profile email read:customers write:customers delete:customers read:products write:products delete:products",
    "client_id": "<seu-client-id>",
    "realm": "Username-Password-Authentication"
  }'
```

Cole o `access_token` recebido em [jwt.io](https://jwt.io) e confirme:

- `aud` inclui `https://admin-api.local`
- `iss` é `https://<seu-tenant>.us.auth0.com/`
- `permissions` contém as 6 strings (admin) ou só 2 (user)

### ⚠️ Desabilite o Password Grant depois

Volta em Applications → admin-web → Settings → Advanced → Grant Types → desmarque **Password** → Save. Em produção SPA usa **só Authorization Code + PKCE**.

---

## 10. Criar a application Native (para o MCP server)

Se você for usar o `apps/admin-mcp` (integrado com Claude Code), precisa criar **outra application** — Native, separada da SPA.

### Criar

**Applications → Applications → + Create Application**:
- Name: `admin-mcp`
- Type: **Native** ⚠️ (não é SPA)

### Settings → Application URIs

| Campo | Valor |
|---|---|
| **Allowed Callback URLs** | `http://localhost:8765/callback` |
| **Allowed Logout URLs** | `http://localhost:8765` |
| **Allowed Web Origins** | *(deixe vazio)* |
| **Allowed Origins (CORS)** | *(deixe vazio)* |

⚠️ Sem barra `/` no final, sem espaços. Save Changes no fim.

### Settings → Advanced Settings → Grant Types

Marcar:
- ✅ **Authorization Code**
- ✅ **Refresh Token**

### Settings → Refresh Token Rotation

- ✅ **Rotation: ON**
- **Reuse Interval:** 0 (default)
- **Absolute Lifetime:** 2592000 (30 dias)

Save Changes.

### Settings → Credentials (se aparecer)

- **Token Endpoint Authentication Method:** `None`

(Native apps já vêm com `None` por padrão. Se a aba Credentials não aparecer, está correto — pode pular.)

### Autorizar a API admin-api

**APIs → admin-api → aba Application Access**:

1. A linha `admin-mcp` deve aparecer com `0/6 permissions granted` em User-delegated
2. Clica em **Edit**
3. Em **User-delegated access**, marcar **TODAS as 6 permissions**:
   - ✅ read:customers
   - ✅ write:customers
   - ✅ delete:customers
   - ✅ read:products
   - ✅ write:products
   - ✅ delete:products
4. **Save**

Linha do `admin-mcp` deve ficar com `6/6 permissions granted` ✅

### Anotar Client ID

Volta em **Applications → admin-mcp → Settings → Basic Information** → copia o **Client ID** (ex: `hknWj9Lq...`). Vai pro `apps/admin-mcp/.env`:

```
MCP_CLIENT_ID=<o-client-id-do-app-native>
```

> Não precisa do `Client Secret` — PKCE não usa.

---

## Recap completo (Auth0)

```
Tenant
├── Applications
│   ├── admin-web (SPA, RS256, PKCE)
│   │   └── Allowed: http://localhost:5173[/]
│   └── admin-mcp (Native, PKCE, Refresh Token Rotation)
│       └── Allowed: http://localhost:8765/callback
├── APIs
│   └── admin-api (audience: https://admin-api.local)
│       ├── 6 permissions: read|write|delete : customers|products
│       ├── RBAC ON + Add Permissions in Token ON
│       └── Application Access:
│           ├── admin-web → 6/6 user-delegated
│           └── admin-mcp → 6/6 user-delegated
├── User Management
│   ├── Roles
│   │   ├── admin   → 6 permissions
│   │   └── user    → 2 permissions (só read:*)
│   └── Users
│       ├── admin@demo.local → role admin
│       └── user@demo.local  → role user
```

Próximos passos:
- **Pra rodar a app web e API:** copie os Client ID + Domain pros respectivos `.env` (veja `apps/admin-api/.env.example` e `apps/admin-web/.env.example`) e rode `docker compose up`.
- **Pra configurar o MCP + Claude Code:** veja [`MCP_SETUP.md`](MCP_SETUP.md).
