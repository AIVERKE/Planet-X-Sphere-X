/** Cliente HTTP hacia el backend FastAPI (proxy Vite en local). */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '').replace(
  /\/$/,
  '',
)

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${BASE_URL}${normalized}`
}

type HttpGetOptions = RequestInit & { timeoutMs?: number }

export async function httpGet<T>(path: string, options?: HttpGetOptions): Promise<T> {
  const controller = new AbortController()
  const { timeoutMs = 55_000, ...init } = options ?? {}
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    })

    if (!response.ok) {
      let detail = response.statusText
      try {
        const body = (await response.json()) as { detail?: string }
        if (body?.detail) detail = body.detail
      } catch {
        // ignore non-JSON error bodies
      }
      throw new Error(`HTTP ${response.status}: ${detail}`)
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Tiempo agotado al consultar el backend / IRSA')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function checkBackendHealth(): Promise<{ status: string }> {
  return httpGet<{ status: string }>('/health')
}

export type ObservationQuery = {
  ra: number
  dec: number
  radius?: number
  collection?: string
  cutout_size?: number
  t_start?: number
  t_end?: number
  group_by_band?: boolean
}

export type ObservationsResponse = {
  query: Record<string, unknown>
  count: number
  observations: Array<Record<string, unknown>>
}

export async function fetchObservations(query: ObservationQuery): Promise<ObservationsResponse> {
  const params = new URLSearchParams({
    ra: String(query.ra),
    dec: String(query.dec),
    radius: String(query.radius ?? 30),
    collection: query.collection ?? 'spherex_dr1',
    cutout_size: String(query.cutout_size ?? 0.05),
  })
  if (query.t_start != null) params.set('t_start', String(query.t_start))
  if (query.t_end != null) params.set('t_end', String(query.t_end))
  if (query.group_by_band) params.set('group_by_band', 'true')

  return httpGet<ObservationsResponse>(`/api/observations?${params.toString()}`)
}
