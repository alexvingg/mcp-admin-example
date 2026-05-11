export type Status = "active" | "inactive";

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: Status;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: string; // Decimal como string (Prisma)
  status: Status;
  createdAt: string;
}

export interface MePayload {
  sub: string;
  aud: string | string[];
  iss: string;
  azp: string;
  scope: string;
  permissions: string[];
  iat: number;
  exp: number;
}

/** Resposta de POST /api/customers/:id/access-request */
export interface Grant {
  userSub: string;
  customerId: string;
  grantedAt: string;
  expiresAt: string;
  ttlSeconds: number;
}

/** Resposta de GET /api/grants/me */
export interface MyGrantsResponse {
  grants: Array<Pick<Grant, "customerId" | "grantedAt" | "expiresAt">>;
  ttlSeconds: number;
}
