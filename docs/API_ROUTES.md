# Rotas da API × Scopes

Todas as rotas (exceto `/api/health`) exigem JWT válido emitido pelo Auth0 com:

- `iss` = `https://<seu-tenant>.us.auth0.com/`
- `aud` contendo `https://admin-api.local`
- assinatura RS256 verificada via JWKS (`/.well-known/jwks.json`)

---

## Rotas públicas

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check. Retorna `{ status, uptime }`. |

---

## Rotas autenticadas

### `/api/me`

| Método | Rota | Permission | Descrição |
|---|---|---|---|
| `GET` | `/api/me` | (qualquer JWT válido) | Retorna o payload do JWT decodado pelo backend (sub, aud, iss, scope, permissions, exp). Útil para debug/dashboard. |

### Customers

| Método | Rota | Tier 1 (scope) | Tier 2 (instância) | 200/201 | 401 | 403 |
|---|---|---|---|---|---|---|
| `GET`    | `/api/customers`      | `read:customers`   | —                       | array | sem token | sem scope |
| `GET`    | `/api/customers/:id`  | `read:customers`   | **requireCustomerAccess** ✅ | obj | sem token | sem scope OU id fora do claim |
| `POST`   | `/api/customers`      | `write:customers`  | —                       | obj 201 | sem token | sem scope |
| `PUT`    | `/api/customers/:id`  | `write:customers`  | —                       | obj   | sem token | sem scope |
| `DELETE` | `/api/customers/:id`  | `delete:customers` | —                       | 204   | sem token | sem scope |

> **Sobre o Tier 2 do GET `/:id`:** o user precisa ter o `:id` dentro do custom claim `https://admin-api.local/customer_access` injetado no JWT por uma Auth0 Action durante o login. Admin (com `write:customers`) faz bypass automaticamente. Detalhes em [`PATTERN_AUTH0_ACTION.md`](PATTERN_AUTH0_ACTION.md).

### Products

| Método | Rota | Permission obrigatória | 200/201 | 401 | 403 |
|---|---|---|---|---|---|
| `GET`    | `/api/products`      | `read:products`   | array | sem token | sem scope |
| `GET`    | `/api/products/:id`  | `read:products`   | obj   | sem token | sem scope |
| `POST`   | `/api/products`      | `write:products`  | obj 201 | sem token | sem scope |
| `PUT`    | `/api/products/:id`  | `write:products`  | obj   | sem token | sem scope |
| `DELETE` | `/api/products/:id`  | `delete:products` | 204   | sem token | sem scope |

---

## Schemas (Zod, validação no backend)

### Customer (POST/PUT)

```typescript
{
  name:   string (1..120, obrigatório)
  email:  string (email válido, obrigatório no POST)
  status: "active" | "inactive" (opcional, default "active")
}
```

`POST` adicional: o email tem unique constraint — duplicado retorna **409**.

### Product (POST/PUT)

```typescript
{
  name:   string (1..120, obrigatório)
  price:  number ou string "0.00" (obrigatório no POST)
  status: "active" | "inactive" (opcional, default "active")
}
```

---

## Erros padronizados

### 401 Unauthorized
```json
{
  "error": "unauthorized",
  "message": "Invalid or missing token"
}
```

### 403 Forbidden
```json
{
  "error": "insufficient_scope",
  "message": "Missing required permission: delete:customers",
  "required": ["delete:customers"],
  "granted": ["read:customers", "read:products"]
}
```

### 400 Bad Request (Zod)
```json
{
  "error": "HttpError",
  "message": "Invalid payload",
  "details": {
    "fieldErrors": {
      "email": ["Invalid email"]
    }
  }
}
```

### 404 / 409
```json
{ "error": "HttpError", "message": "Customer not found" }
```

---

## Quem implementa o quê (backend)

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| `checkJwt` middleware | `src/middleware/auth.ts` | Valida assinatura, audience, issuer |
| `requireScope(...)` | `src/middleware/requireScope.ts` | Tier 1 — lê `permissions[]` e `scope` do JWT, retorna 403 se faltar |
| `requireCustomerAccess` | `src/middleware/requireCustomerAccess.ts` | Tier 2 — lê custom claim e valida `req.params.id`. Admin bypassa |
| `internalRouter` | `src/modules/internal/internal.routes.ts` | Endpoint PSK chamado pela Auth0 Action no login |
| `customerAccessStore` | `src/modules/internal/customer-access.store.ts` | Store in-memory de quem tem acesso a quê (seedado no boot) |
| Routes | `src/modules/<entity>/<entity>.routes.ts` | Compõe `checkJwt + requireScope + controller` |
| Controllers | `src/modules/<entity>/<entity>.controller.ts` | Orquestra request → service |
| Services | `src/modules/<entity>/<entity>.service.ts` | Validação Zod + regras de negócio |
| Repository | `src/modules/<entity>/<entity>.repository.ts` | Acesso ao Prisma |

---

## Endpoints internos (PSK, não usam JWT)

| Método | Rota | Auth | Quem chama | O que faz |
|---|---|---|---|---|
| `POST` | `/internal/permissions` | `x-internal-psk` header | Auth0 Action `add-customer-access-to-jwt` | Recebe `{ sub, requestedScopes }`, retorna `{ customer_access: [...ids] }` |

Body:
```json
{
  "sub": "auth0|regular-user-sub",
  "requestedScopes": ["openid", "read:customers"]
}
```

Response 200:
```json
{ "customer_access": ["cmow1yxwx0000p86ii31r8vcx", "cmow1yxx50001p86ilppus155"] }
```

Response 401 (PSK inválido):
```json
{ "error": "unauthorized", "message": "Missing or invalid x-internal-psk" }
```

Response 400 (body inválido):
```json
{ "error": "bad_request", "details": { "fieldErrors": { "sub": ["Required"] } } }
```
