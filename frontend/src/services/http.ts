/** Cliente HTTP mínimo para APIs externas (solo frontend). */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export async function httpGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json() as Promise<T>
}
