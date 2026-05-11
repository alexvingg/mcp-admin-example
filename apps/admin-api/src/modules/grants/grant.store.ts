/**
 * Grants store — Map<userSub:customerId, Grant> com TTL.
 *
 * Substitui o "tudo no JWT". Inspirado no `RMapCache<String, Grant>` que o
 * pattern enterprise usa em Redis pra suportar TTL e fresh state.
 *
 * Em produção: trocar por Redis. A interface `grants` aqui foi pensada pra
 * ser drop-in compatível com `RMapCache`.
 */

const TTL_MS_DEFAULT = Number(process.env.GRANT_TTL_SECONDS ?? 300) * 1000; // 5 min

export interface Grant {
  userSub: string;
  customerId: string;
  grantedAt: Date;
  expiresAt: Date;
}

const store = new Map<string, Grant>();

const key = (userSub: string, customerId: string) => `${userSub}:${customerId}`;

export const grantStore = {
  /**
   * Cria/sobrescreve um grant ativo. Reset do TTL ao reusar.
   */
  create(userSub: string, customerId: string, ttlMs: number = TTL_MS_DEFAULT): Grant {
    const now = new Date();
    const grant: Grant = {
      userSub,
      customerId,
      grantedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    };
    store.set(key(userSub, customerId), grant);
    return grant;
  },

  /**
   * Retorna o grant SE ainda estiver válido.
   * Se expirado, faz lazy-delete e retorna null.
   */
  getActive(userSub: string, customerId: string): Grant | null {
    const k = key(userSub, customerId);
    const grant = store.get(k);
    if (!grant) return null;
    if (grant.expiresAt.getTime() <= Date.now()) {
      store.delete(k);
      return null;
    }
    return grant;
  },

  /**
   * Lista grants ativos de um user (não expirados). Usado pra debug/UI.
   */
  listActiveFor(userSub: string): Grant[] {
    const now = Date.now();
    const result: Grant[] = [];
    for (const [k, g] of store.entries()) {
      if (g.userSub !== userSub) continue;
      if (g.expiresAt.getTime() <= now) {
        store.delete(k);
        continue;
      }
      result.push(g);
    }
    return result;
  },

  /**
   * Revoga um grant antes do TTL natural. Idempotente.
   */
  revoke(userSub: string, customerId: string): boolean {
    return store.delete(key(userSub, customerId));
  },
};

export const GRANT_TTL_MS = TTL_MS_DEFAULT;
