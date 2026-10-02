const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Thin fetch wrapper: prefixes the API base URL, parses JSON, and
 * turns non-2xx responses into a typed ApiError so components can
 * distinguish "request failed" from "network unreachable".
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // response had no JSON body; keep the generic message
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}
