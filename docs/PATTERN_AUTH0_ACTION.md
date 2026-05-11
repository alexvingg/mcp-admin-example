# Pattern: Autorização por instância — Runtime Grants (pattern enterprise)

Documento técnico explicando a arquitetura de autorização **por instância** implementada no demo, fielmente inspirada no pattern usado em produção em sistemas enterprise.

> **Histórico:** este projeto começou com uma versão "tudo-no-JWT" (Auth0 Action injetando claim com lista de ids). Migramos pra esta versão com **grants em runtime** porque é o que escala em produção. A versão original ainda está descrita na seção "Apêndice — Histórico" no final.

---

## TL;DR

```
JWT do user (somente identidade + role coarse):
  { sub, permissions: [read:customers], ... }

Backend mantém 2 stores:
  ENTITLEMENT (durável):  Map<userSub, Set<customerId>>   ← "alex pode acessar Maria"
  GRANT (efêmero, TTL):   Map<userSub:customerId, Grant>  ← "alex está acessando Maria agora"

Fluxo de detalhe:
  Frontend POST /api/customers/:id/access-request
    → backend valida ENTITLEMENT
    → cria GRANT com TTL (5min)
  Frontend GET /api/customers/:id
    → middleware verifica GRANT ativo
    → 200 (ou 403 se sem grant)
```

---

## Por que NÃO carregar tudo no JWT

Versão original do demo:
```js
// Auth0 Action no login
const ids = await fetch("/internal/permissions").json();
api.accessToken.setCustomClaim("https://admin-api.local/customer_access", ids);
```

Funciona pra dezenas de ids. **Quebra acima de ~50–100 ids por user**:

| Problema | Por quê |
|---|---|
| **JWT bloat** | 10k ids × 25 chars = 250KB de header em cada request HTTP |
| **Limite de proxies** | nginx default rejeita header > 8KB |
| **Token stale** | Mudança no entitlement só vale após relogin (24h padrão) |
| **Login lento** | Action faz query pesada na API a cada login |
| **Custo Auth0** | Logins ficam mais caros conforme N cresce |

Pra escala real, **autorização por instância vive no backend**, não no token. JWT só carrega identidade.

---

## Arquitetura de produção (esta)

```
┌──────────────────────────────────────────────────────────┐
│ Auth0 Tenant                                             │
│ JWT enxuto: { sub, permissions: [read:customers], ... }  │
│ Sem custom claim de customer_access. Action pode ser     │
│ removida — apenas identidade.                            │
└──────────────────────┬───────────────────────────────────┘
                       │ Bearer JWT
                       ▼
┌──────────────────────────────────────────────────────────┐
│ admin-api (Express)                                      │
│                                                          │
│ Tier 1 — Filter (já existia):                            │
│   checkJwt → requireScope("read:customers")              │
│   bloqueia 401/403 cedo                                  │
│                                                          │
│ Tier 1.5 — Entitlement check (no service):               │
│   POST /api/customers/:id/access-request                 │
│     Body: vazio (sub vem do JWT)                         │
│     → grantService.requestAccess({ userSub, customerId })│
│         - admin? → bypass                                │
│         - else: customerEntitlementsStore.has(...)?      │
│           sim → cria grant com TTL                       │
│           não → 403 "no_entitlement"                     │
│                                                          │
│ Tier 2 — Grant check (middleware):                       │
│   GET /api/customers/:id                                 │
│     requireCustomerAccess:                               │
│       - admin? → bypass                                  │
│       - else: grantStore.getActive(sub, id)?             │
│         sim → next()                                     │
│         não → 403 "no_active_grant"                      │
│                                                          │
│ Stores:                                                  │
│   customerEntitlementsStore (durável; in-mem → DB prod)  │
│   grantStore (TTL 5min; in-mem → Redis prod)             │
└──────────────────────────────────────────────────────────┘
```

---

## Os 2 stores em detalhe

### `customerEntitlementsStore` — fonte da verdade

```typescript
Map<userSub, Set<customerId>>
```

- Estado **durável**: "admin/RH definiu que Alex pode acessar Maria"
- Mudanças aqui acontecem fora-de-banda (UI admin, scripts, importação)
- Pra demo: Map em memória, seedado no boot
- Pra produção: tabela `customer_entitlements (user_sub, customer_id, granted_at, granted_by)` no Postgres

### `grantStore` — estado runtime com TTL

```typescript
Map<"userSub:customerId", { userSub, customerId, grantedAt, expiresAt }>
```

- Estado **efêmero**: "Alex pediu pra ver Maria há 2 minutos, ainda tem 3 minutos"
- Cada `POST /access-request` cria/refresca um grant
- Auto-expira via lazy delete (`getActive` filtra expirados)
- Pra demo: Map em memória com TTL de **5 minutos** (configurável via `GRANT_TTL_SECONDS` env)
- Pra produção: Redis com TTL nativo (`SET key value EX 300`). sistemas enterprise usam exatamente isso.

---

## Comparativo direto com pattern enterprise

| Peça | Enterprise (prod) | Nossa demo |
|---|---|---|
| Storage de grants | `RMapCache<String, Grant>` no Redis | `Map<string, Grant>` em memória |
| TTL default | 10 segundos | 5 minutos (mais usável pra demo) |
| Endpoint pra criar grant | `POST /api/0.1/admin/me/sensitive-data` | `POST /api/customers/:id/access-request` |
| Endpoint pra checar grant | `GET /api/0.1/admin/me/sensitive-data` | Inline no middleware (zero HTTP extra) |
| Auth do endpoint | JWT + `x-admin-user` + `x-client-hash` magic | Só JWT |
| Quem cria o grant? | qualquer admin com `ROLE_VIEW_SENSITIVE_DATA` | qualquer não-admin com entitlement; admin bypassa |
| Comparação `grant.userId` vs URL id? | **Não** (campo existe, ignorado — lacuna conhecida) | **Sim** (fechamos a lacuna via `customerEntitlementsStore.has`) |
| Audit log | audit table no DB | `console.log` (em prod vai pra SIEM) |
| Ação em 403 | retorna 200 com CPF mascarado | retorna 403 com `error: no_active_grant` |
| Frontend faz POST grant antes? | sim (gesto explícito de "pedir acesso") | sim (auto no mount do detalhe) |

A diferença filosófica do "403 vs CPF mascarado": **Sistemas enterprise escondem o dado, nós bloqueamos a request**. Ambos são patterns válidos — depende do produto. Mascarar é melhor pra UX (user vê algo); bloquear é melhor pra "esse dado não deveria nem aparecer pra esse role".

---

## API de runtime

### `POST /api/customers/:id/access-request`

**Headers:** `Authorization: Bearer <jwt>`

**Body:** vazio ou `{}`

**201 Created** (entitlement OK ou admin):
```json
{
  "userSub": "auth0|...",
  "customerId": "cmow1yxwx0000...",
  "grantedAt": "2026-05-08T18:40:18.556Z",
  "expiresAt": "2026-05-08T18:45:18.556Z",
  "ttlSeconds": 300
}
```

**403 Forbidden** (sem entitlement):
```json
{
  "error": "no_entitlement",
  "message": "User auth0|... is not entitled to access customer cmow..."
}
```

### `GET /api/customers/:id`

**Headers:** `Authorization: Bearer <jwt>`

**200 OK** (grant ativo ou admin) — payload do customer.

**403 Forbidden** (sem grant ativo):
```json
{
  "error": "no_active_grant",
  "message": "No active access grant for this customer. Call POST /api/customers/:id/access-request first.",
  "hint": {
    "method": "POST",
    "path": "/api/customers/:id/access-request",
    "ttlSeconds": 300
  }
}
```

### `GET /api/grants/me`

Lista grants ativos do user logado. Útil pra UI mostrar "você tem N acessos abertos, expirando em X".

```json
{
  "grants": [
    { "customerId": "cmow1yxwx0000...", "grantedAt": "...", "expiresAt": "..." }
  ],
  "ttlSeconds": 300
}
```

---

## Frontend — fluxo no `CustomerDetail.tsx`

```typescript
useEffect(() => {
  // Step 1: pede grant
  const grantRes = await fetch(`/api/customers/${id}/access-request`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (grantRes.status === 403) {
    // 403 no_entitlement: user não tem direito a esse customer.
    // Mostra mensagem inline (não redireciona) — gesto educativo.
    return setState({ kind: "no_entitlement", message: ... });
  }

  // Step 2: GET detalhe (middleware Tier 2 verifica grant ativo)
  const detailRes = await fetch(`/api/customers/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  setState({ kind: "success", data: await detailRes.json(), grant });
}, [id]);
```

Mostra também um **badge com countdown** ("Grant ativo, expira em 04:23") usando `setInterval` no client. UX 🍒 reforçando que grants são temporais.

---

## Trade-offs e quando evoluir

### O que está bom

- ✅ JWT enxuto — escala pra qualquer N
- ✅ Mudança em entitlement reflete imediato (próximo POST de grant)
- ✅ Grants temporais → audit forte ("user X teve acesso a Y entre H1 e H2")
- ✅ Admin bypass mantém UX rápida pra quem tem write
- ✅ Endpoint interno antigo (`/internal/permissions`) pode ser removido junto com a Action Auth0

### O que evoluiria pra produção

| Demo | Produção |
|---|---|
| `Map` em memória pra grants | Redis com `SET ... EX <ttl>` |
| `Map` em memória pra entitlements | Tabela Postgres + UI admin pra gerenciar |
| `console.log` audit | SIEM / DataDog / tabela `audit_log` |
| TTL fixo 5min | TTL configurável por tipo de operação (5min ler, 30s aprovar) |
| Sem 4-eyes approval | Workflow: admin pede, outro admin aprova, grant nasce |
| Frontend pede grant automaticamente | Frontend pode exigir confirmação ("Deseja abrir acesso por 5min?") pra ações sensíveis |

---

## Apêndice — histórico (versão Action + custom claim)

A versão anterior usava Auth0 Action injetando lista completa de ids num custom claim no JWT. Funcionou pra ensinar o conceito de Action + custom claim, mas tem limites:

```javascript
// Action (versão antiga — substituída)
exports.onExecutePostLogin = async (event, api) => {
  const sub = event.user.user_id;
  const res = await fetch(`${event.secrets.ADMIN_API_URL}/internal/permissions`, {
    method: "POST",
    headers: { "x-internal-psk": event.secrets.INTERNAL_PSK },
    body: JSON.stringify({ sub })
  });
  const { customer_access } = await res.json();
  api.accessToken.setCustomClaim(
    "https://admin-api.local/customer_access",
    customer_access
  );
};
```

E no backend, o middleware lia esse claim e validava direto:
```js
if (!claim.includes(req.params.id)) → 403
```

Limitações que motivaram a migração:
- **JWT bloat linear** ao N de customers
- **Stale data** — qualquer mudança exigia relogin
- **Latência adicional no login** — Action chama backend a cada login
- **Auth0 cobra por chamadas** de Actions, escala caro

A Action foi mantida como **stub** (retorna array vazio) por backward compat. Pode-se desligar/excluir pelo dashboard Auth0 sem efeito colateral.

---

## Referências

- [RFC 6749 §3.3 — OAuth Scopes](https://www.rfc-editor.org/rfc/rfc6749#section-3.3) (por que scopes são coarse-grained)
- [Auth0 Actions](https://auth0.com/docs/customize/actions)
- [Custom Claims](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims)
- Pattern em produção (enterprise reference): login Action + runtime grant service
- [Redis EXPIRE](https://redis.io/docs/latest/commands/expire/) (TTL nativo pra grants)
- [Auth0 FGA](https://docs.fga.dev/) (alternativa enterprise pra autorização granular)

---

## Glossário

- **Entitlement** — direito durável: "alex tem permissão de acessar customer Y"
- **Grant** — permissão runtime efêmera: "alex está acessando customer Y agora (próximos 5min)"
- **Tier 1** — filter coarse (RBAC scope check)
- **Tier 2** — checagem fine por instância (grant lookup)
- **Bypass admin** — admin com `write:customers` pula tanto entitlement check quanto grant check
- **PSK** — pre-shared key entre Auth0 Action e backend (não mais usado nesse pattern, mas mantido pra Action stub)
- **TTL** — time-to-live do grant; após expirar, novo POST `/access-request` é necessário
