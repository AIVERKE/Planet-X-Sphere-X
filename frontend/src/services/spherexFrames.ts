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
  // La primera pasada baja hasta 16 FITS desde IRSA; puede pasar de dos minutos.
  return httpGet<SpherexFramesResponse>(`/api/observations/frames?${params.toString()}`, {
    timeoutMs: 45_000,
  })
}
