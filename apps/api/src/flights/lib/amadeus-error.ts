/** The `amadeus` SDK ships no TypeScript types and throws plain objects shaped like `{ description, response: { statusCode, body }, message }` — this extracts a readable string from whichever of those is present. */
export function amadeusErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const shaped = err as {
      response?: { statusCode?: number; body?: unknown; result?: unknown };
      description?: unknown;
      message?: string;
    };
    if (shaped.response) {
      const detail =
        shaped.response.result ?? shaped.response.body ?? shaped.description;
      return `${shaped.response.statusCode ?? ''} ${
        typeof detail === 'string' ? detail : JSON.stringify(detail)
      }`.trim();
    }
    if (shaped.message) return shaped.message;
  }
  return String(err);
}
