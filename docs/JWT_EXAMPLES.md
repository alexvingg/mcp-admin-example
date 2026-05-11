# JWT — exemplos de payload

Após o login com cada tipo de usuário, o `access_token` retornado tem estrutura diferente. Cole tokens em [jwt.io](https://jwt.io) para inspecionar.

---

## admin@demo.local — todas as permissions

```json
{
  "iss": "https://your-tenant.us.auth0.com/",
  "sub": "auth0|admin-user-sub",
  "aud": [
    "https://admin-api.local",
    "https://your-tenant.us.auth0.com/userinfo"
  ],
  "iat": 1778191243,
  "exp": 1778277643,
  "scope": "openid profile email read:customers write:customers delete:customers read:products write:products delete:products",
  "azp": "your-spa-client-id",
  "permissions": [
    "delete:customers",
    "delete:products",
    "read:customers",
    "read:products",
    "write:customers",
    "write:products"
  ]
}
```

**Header:** `{ "alg": "RS256", "typ": "JWT", "kid": "<key id>" }`

---

## user@demo.local — só leitura

```json
{
  "iss": "https://your-tenant.us.auth0.com/",
  "sub": "auth0|regular-user-sub",
  "aud": [
    "https://admin-api.local",
    "https://your-tenant.us.auth0.com/userinfo"
  ],
  "iat": 1778191346,
  "exp": 1778277746,
  "scope": "openid profile email read:customers read:products",
  "azp": "your-spa-client-id",
  "permissions": [
    "read:customers",
    "read:products"
  ]
}
```

**Note:** mesmo o cliente pedindo as 6 scopes no `authorize`, o Auth0 **filtra** baseado nas permissions do role, e devolve só `read:customers read:products` no `scope` e em `permissions`.

---

## Claims importantes

| Claim | Origem | Como o backend usa |
|---|---|---|
| `iss` | Auth0 (issuer base URL) | Validado contra `AUTH0_ISSUER_BASE_URL` |
| `aud` | API identifier configurado | Validado contra `AUTH0_AUDIENCE` |
| `sub` | ID interno do user no Auth0 | Identificação do usuário |
| `azp` | Authorized Party (Client ID da SPA) | Quem está pedindo o token |
| `scope` | string com permissions separadas por espaço | Fallback de autorização |
| `permissions` | array (vem do RBAC + "Add Permissions in Access Token") | **Fonte primária** que `requireScope` consulta |
| `iat` | issued at (Unix epoch) | timestamp da emissão |
| `exp` | expires at (Unix epoch) | backend rejeita se passou |

---

## Como obter um token pra testar

### A. Pelo navegador (recomendado)

1. Login no http://localhost:5173
2. DevTools → Application → Local Storage → procure key tipo `@@auth0spajs@@::...::https://admin-api.local::...`
3. Copie o valor do campo `access_token` interno

### B. Via curl (Password Grant — só pra dev)

Veja `docs/AUTH0_SETUP.md` seção "Validar com curl". Habilite o grant temporariamente, faça a request, cole o token em jwt.io.

---

## Como o backend valida (resumo do fluxo)

```
1. Cliente envia: Authorization: Bearer <token>
2. checkJwt middleware (express-oauth2-jwt-bearer):
     a. Decoda header → pega kid
     b. Busca chave pública via JWKS: https://<tenant>/.well-known/jwks.json
     c. Verifica assinatura RS256
     d. Verifica iss === AUTH0_ISSUER_BASE_URL
     e. Verifica aud inclui AUTH0_AUDIENCE
     f. Verifica exp > now
     → ok? popula req.auth.payload
     → falha? 401
3. requireScope("delete:customers") middleware:
     a. Lê req.auth.payload.permissions (array do RBAC)
     b. Lê req.auth.payload.scope (string fallback)
     c. Une os dois em um Set<string>
     d. Verifica todos os scopes requeridos estão presentes
     → ok? next()
     → falha? 403 + JSON com required/granted
4. Controller executa
```

JWKS é cacheado pelo middleware automaticamente — só faz fetch quando a chave roda no Auth0.
