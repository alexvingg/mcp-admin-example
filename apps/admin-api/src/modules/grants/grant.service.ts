/**
 * Service de grants — encapsula a regra de "pode pedir grant?".
 *
 * Distinção importante:
 *   - ENTITLEMENT (fonte de verdade de quem PODE acessar) → store separado
 *     (in-memory por enquanto, viraria DB em produção)
 *   - GRANT (estado runtime de quem ESTÁ acessando agora) → grantStore
 *
 * Análogo a sistemas enterprise:
 *   - Entitlement = `Grant.userId` no schema deles (ainda não validado, lacuna)
 *   - Grant       = entry no Redis com TTL
 *
 * Aqui fechamos a lacuna: a criação do grant SÓ é permitida se o user
 * tiver entitlement pro customer pedido.
 */
import { customerEntitlementsStore } from "../internal/customer-entitlements.store.js";
import { grantStore, type Grant, GRANT_TTL_MS } from "./grant.store.js";
import { HttpError } from "../../errors/httpError.js";

export class NoEntitlementError extends HttpError {
  constructor(userSub: string, customerId: string) {
    super(
      403,
      `User ${userSub} is not entitled to access customer ${customerId}`,
      { userSub, customerId },
    );
    this.name = "NoEntitlementError";
  }
}

export const grantService = {
  /**
   * Cria um grant pro user acessar o customer.
   * Se admin (passado em isAdmin), bypassa o entitlement check.
   * Se não-admin sem entitlement → NoEntitlementError (403).
   */
  requestAccess(opts: {
    userSub: string;
    customerId: string;
    isAdmin: boolean;
  }): Grant {
    const { userSub, customerId, isAdmin } = opts;

    if (!isAdmin) {
      const entitled = customerEntitlementsStore.has(userSub, customerId);
      if (!entitled) throw new NoEntitlementError(userSub, customerId);
    }

    const grant = grantStore.create(userSub, customerId);

    // Audit log mínimo — em produção iria pro uma audit table / SIEM / etc.
    console.log(
      `[grant] created  user=${userSub}  customer=${customerId}  ` +
        `expires=${grant.expiresAt.toISOString()}  admin=${isAdmin}`,
    );

    return grant;
  },

  /** Confere se há grant ativo. Usado pelo middleware Tier 2. */
  hasActiveGrant(userSub: string, customerId: string): boolean {
    return grantStore.getActive(userSub, customerId) !== null;
  },

  /** Lista grants ativos do user. Pra UI/debug. */
  listMine(userSub: string): Grant[] {
    return grantStore.listActiveFor(userSub);
  },

  ttlSeconds(): number {
    return GRANT_TTL_MS / 1000;
  },
};
