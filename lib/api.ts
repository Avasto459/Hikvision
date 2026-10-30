/**
 * Small helper for calling the app's JSON API from client components.
 *
 * Guarantees:
 * - never rejects: an unreachable server must not surface as a raw
 *   "Failed to fetch" in the UI — it becomes a readable message instead;
 * - an HTML answer (proxy/404/500 pages) is detected and converted to a
 *   status-based message instead of crashing `response.json()`;
 * - the caller passes a relative URL, so the request always stays on the
 *   page's own origin (no hardcoded localhost or external ports).
 */

export type ApiPayload = { success?: boolean; message?: string; error?: string };

export type ApiSuccess<T> = {
  ok: true;
  status: number;
  /** API `message` or the caller's fallback — always safe to show to a visitor. */
  message: string;
  /** Parsed JSON body of a successful response. */
  data: T;
};

export type ApiFailure = {
  ok: false;
  status: number;
  /** Readable reason: API `error`/`message`, a network problem or an HTTP status. */
  message: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const NETWORK_MESSAGE = "Не удалось связаться с сервером. Проверьте, что приложение запущено, и повторите попытку.";

/** POSTs JSON to `path` and always resolves with a user-readable result. */
export async function postJson<T = ApiPayload>(
  path: string,
  body: unknown,
  fallbackMessage: string,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // The parsed body carries the API envelope (`success`, `message`, `error`)
    // plus endpoint-specific fields (`devCode`, …) exposed as `data`.
    let payload: (ApiPayload & T) | null = null;
    try {
      payload = await response.json() as ApiPayload & T;
    } catch {
      payload = null; // HTML or empty answer — handled below via the status code.
    }
    if (!payload) {
      return { ok: false, status: response.status, message: `${fallbackMessage} Сервер ответил ошибкой HTTP ${response.status}.` };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, message: payload.error || payload.message || `${fallbackMessage} (HTTP ${response.status}).` };
    }
    return { ok: true, status: response.status, message: payload.message || fallbackMessage, data: payload };
  } catch (error) {
    // fetch() rejects only on network-level problems: server is down, CORS, blocked request.
    if (error instanceof TypeError) {
      return { ok: false, status: 0, message: NETWORK_MESSAGE };
    }
    return { ok: false, status: 0, message: error instanceof Error && error.message ? error.message : fallbackMessage };
  }
}
