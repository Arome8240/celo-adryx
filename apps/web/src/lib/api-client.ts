import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message ?? `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

/**
 * A single retry-after-refresh, not a queue — good enough for this app's
 * request volume. A burst of parallel 401s would each trigger their own
 * refresh call; revisit with a shared in-flight promise if that becomes a
 * real problem.
 */
async function refreshSession(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    useAuthStore.getState().clearSession();
    return false;
  }
  const body = await res.json();
  useAuthStore
    .getState()
    .setSession(body.user, body.accessToken, body.refreshToken);
  return true;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  { skipAuthRetry = false }: { skipAuthRetry?: boolean } = {},
): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, init, { skipAuthRetry: true });
    }
  }

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}
