import { httpGet } from '@/services/http'

export type SpherexFrame = {
  obs_id: string
  t_min: number
  t_max: number | null
  band: string
  /** Vista científica del satélite (puede verse pixeleada). */
  png_url: string
  /** Misma época, render HD (relleno + upscale) para el blink didáctico. */
  png_url_hd: string
}

export type SpherexFramesResponse = {
  query: Record<string, unknown>
  band: string
  available_bands: string[]
  matched: number
  returned: number
  vmin: number
  vmax: number
  frames: SpherexFrame[]
}

export type SpherexFramesQuery = {
  ra: number
  dec: number
  radius?: number
  cutoutSize?: number
  band?: string | null
  collection?: string
}

const BARNARD = { ra: 269.44638, dec: 4.76677, r: 0.2 }
const IRSA_OUTAGE_KEY = 'spherex-irsa-outage-until'

/** Caché local SPHEREx (demo) solo cubre Barnard's Star cuando IRSA cae. */
export function nearBarnardOffline(ra: number, dec: number): boolean {
  const dra = (ra - BARNARD.ra) * Math.cos((BARNARD.dec * Math.PI) / 180)
  const ddec = dec - BARNARD.dec
  return Math.hypot(dra, ddec) <= BARNARD.r
}

export function markIrsaOutage(ms = 120_000) {
  try {
    sessionStorage.setItem(IRSA_OUTAGE_KEY, String(Date.now() + ms))
  } catch {
    /* ignore */
  }
}

export function irsaLikelyDown(): boolean {
  try {
    return Date.now() < Number(sessionStorage.getItem(IRSA_OUTAGE_KEY) || 0)
  } catch {
    return false
  }
}

/** Lista de épocas SPHEREx de un detector, con PNG ya estirados. */
export async function fetchSpherexFrames(query: SpherexFramesQuery): Promise<SpherexFramesResponse> {
  const params = new URLSearchParams({
    ra: String(query.ra),
    dec: String(query.dec),
    radius: String(query.radius ?? 90),
    collection: query.collection ?? 'spherex_dr1',
    cutout_size: String(query.cutoutSize ?? 0.08),
  })
  if (query.band) params.set('band', query.band)

  // Barnard tiene respaldo local en el backend; el resto falla rápido si IRSA ya saturó.
  const barnard = nearBarnardOffline(query.ra, query.dec)
  const timeoutMs = barnard ? 28_000 : irsaLikelyDown() ? 7_000 : 18_000

  try {
    return await httpGet<SpherexFramesResponse>(`/api/observations/frames?${params.toString()}`, {
      timeoutMs,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (
      msg.includes('HTTP 503') ||
      msg.includes('HTTP 502') ||
      msg.includes('HTTP 504') ||
      msg.includes('Tiempo agotado')
    ) {
      markIrsaOutage()
    }
    throw error
  }
}
