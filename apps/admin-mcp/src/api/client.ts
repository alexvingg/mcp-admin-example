/**
 * Cliente HTTP pra admin-api. Reusa o token do auth/index e injeta Bearer.
 *
 * Erros do admin-api (401, 403, 404, etc) são jogados como ApiError com
 * status + body — handler das tools converte em texto pra LLM consumir.
 */
import { env } from "../config.js";
import { getValidAccessToken } from "../auth/index.js";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken();
  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  let body: any = undefined;
  try {
    body = await res.json();
  } catch {
    // ignora — body pode estar vazio
  }

  if (!res.ok) {
    const message =
      body?.message ??
      (body?.error ? `${body.error}` : `HTTP ${res.status}`);
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}
