/**
 * Customer ENTITLEMENTS — fonte de verdade de quem PODE acessar quê.
 *
 * Distinção do GRANT:
 *   - Entitlement: estado durável ("admin/RH definiu que alex pode ver Maria")
 *   - Grant:       estado runtime  ("alex está visualizando Maria nos próximos 5 min")
 *
 * Em produção: tabela `customer_entitlements (user_sub, customer_id)` no DB,
 * gerenciada via UI admin. Pra demo: in-memory Map seedado no boot.
 */

const store = new Map<string /* userSub */, Set<string /* customerId */>>();

export const customerEntitlementsStore = {
  /** Substitui o conjunto de customers que `userSub` está autorizado a ver. */
  set(userSub: string, customerIds: string[]) {
    store.set(userSub, new Set(customerIds));
  },

  /** Lista os customer ids a que `userSub` está autorizado. */
  get(userSub: string): string[] {
    return Array.from(store.get(userSub) ?? new Set());
  },

  /** True se `userSub` está autorizado a acessar `customerId`. */
  has(userSub: string, customerId: string): boolean {
    return store.get(userSub)?.has(customerId) ?? false;
  },

  /** Total de users com algum entitlement (debug). */
  size(): number {
    return store.size;
  },
};
