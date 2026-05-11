/**
 * Cliente HTTP que injeta o Bearer token automaticamente, e trata 401/403
 * via callbacks injetados pelo provider (em main.tsx).
 *
 * Uso típico: hooks de React Query consomem este cliente.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export interface ApiClientOptions {
  /** Função que devolve um access_token Auth0 válido. */
  getToken: () => Promise<string>;
  /** Chamado quando a API responde 401 (token inválido/expirado). */
  on401?: () => void;
  /** Chamado quando a API responde 403 (sem scope). */
  on403?: (info: { message: string; required?: string[]; granted?: string[] }) => void;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(opts: ApiClientOptions) {
  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await opts.getToken();

    const res = await fetch(`${API_BASE_URL}${path}`, {
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
      // ignore
    }

    if (res.status === 401) {
      opts.on401?.();
      throw new ApiError(401, body?.message ?? "Unauthorized", body);
    }

    if (res.status === 403) {
      opts.on403?.({
        message: body?.message ?? "Forbidden",
        required: body?.required,
        granted: body?.granted,
      });
      throw new ApiError(403, body?.message ?? "Forbidden", body);
    }

    if (!res.ok) {
      throw new ApiError(res.status, body?.message ?? `HTTP ${res.status}`, body);
    }

    return body as T;
  }

  return {
    get:    <T>(p: string) => request<T>(p, { method: "GET" }),
    post:   <T>(p: string, data: unknown) =>
      request<T>(p, { method: "POST",   body: JSON.stringify(data) }),
    put:    <T>(p: string, data: unknown) =>
      request<T>(p, { method: "PUT",    body: JSON.stringify(data) }),
    delete: <T>(p: string) => request<T>(p, { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
