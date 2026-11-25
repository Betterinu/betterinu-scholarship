/**
 * Server-side client for the CRM's public API.
 *
 * The key must never reach the browser. Nothing here is prefixed
 * NEXT_PUBLIC_, and this module is imported only by route handlers under
 * src/app/api/ — never by a component. Keep it that way.
 *
 * Talking to the CRM from our server rather than the browser is also what
 * makes CORS a non-issue: the CRM sends no Access-Control-Allow-Origin, and
 * server-to-server requests don't ask for one.
 */

export interface CrmResponse {
  status: number
  body: unknown
}

/** Thrown when the env vars are missing, so routes can answer 503 rather than 500. */
export class CrmConfigError extends Error {
  constructor() {
    super('CRM_BASE_URL and CRM_API_KEY must both be set. See .env.example.')
    this.name = 'CrmConfigError'
  }
}

// Read inside the call, not at module scope: at build time these are undefined
// and a top-level throw would break `next build`.
function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.CRM_BASE_URL
  const apiKey = process.env.CRM_API_KEY
  if (!baseUrl || !apiKey) throw new CrmConfigError()
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

export async function crmFetch(
  path: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
): Promise<CrmResponse> {
  const { baseUrl, apiKey } = config()

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...init.headers,
    },
  })

  // The CRM answers JSON on both success and error; a null body means it
  // returned something unexpected (a proxy error page, usually).
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}
