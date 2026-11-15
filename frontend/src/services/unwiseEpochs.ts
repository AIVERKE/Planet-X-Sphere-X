/**
 * Épocas WISE time-resolved (WiseView / unWISE).
 * No usa coadds NEO acumulativos del Legacy Survey: esos casi no muestran movimiento.
 * WiseView sí separa ventanas temporales → blink con desplazamiento real.
 */

import { apiUrl, httpGet } from '@/services/http'

export type EpochStamp = {
  id: string
  label: string
  filter: string
  jpegUrl: string
  fitsUrl: string
  yearHint: string
  /** MJD medio de la ventana WiseView (metadato real de la época). */
  mjd?: number | null
}

type WiseViewFramesResponse = {
  matched: number
  returned: number
  ra: number
  dec: number
  frames: Array<{
    id: string
    label: string
    year_hint: string
    mjd: number | null
    png_url: string
  }>
}

export function wiseviewPortalUrl(ra: number, dec: number, sizeArcsec = 176): string {
  const params = new URLSearchParams({
    ra: String(ra),
    dec: String(dec),
    size: String(sizeArcsec),
    band: '3',
  })
  return `https://byw.tools/wiseview?ra=${params.get('ra')}&dec=${params.get('dec')}&size=${params.get('size')}&band=3&window=0`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function preloadJpegOnce(url: string, timeoutMs = 25_000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      resolve(ok)
    }
    const timer = window.setTimeout(() => finish(false), timeoutMs)
    img.onload = () => finish(img.naturalWidth > 8 && img.naturalHeight > 8)
    img.onerror = () => finish(false)
    img.src = url
  })
}

async function preloadJpeg(url: string, tries = 3): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const bust = i === 0 ? url : `${url}${url.includes('?') ? '&' : '?'}_r=${i}`
    if (await preloadJpegOnce(bust)) return true
    await sleep(200 + i * 350)
  }
  return false
}

/**
 * Sellos time-resolved oficiales (WiseView). Varias fechas reales, no un solo coadd.
 */
export async function fetchUnwiseEpochStamps(
  ra: number,
  dec: number,
  size = 160,
): Promise<EpochStamp[]> {
  const params = new URLSearchParams({
    ra: String(ra),
    dec: String(dec),
    size: String(Math.max(64, Math.min(256, size))),
  })
  const meta = await httpGet<WiseViewFramesResponse>(`/api/cutouts/wiseview?${params.toString()}`, {
    timeoutMs: 70_000,
  })

  const candidates = meta.frames.map((frame) => {
    const jpegUrl = apiUrl(frame.png_url)
    return {
      id: frame.id,
      label: frame.label,
      filter: 'wiseview-tr',
      jpegUrl,
      fitsUrl: wiseviewPortalUrl(ra, dec),
      yearHint: frame.year_hint,
      mjd: frame.mjd,
    } satisfies EpochStamp
  })

  if (candidates.length < 2) {
    throw new Error('WiseView no devolvió suficientes épocas time-resolved')
  }

  const ok: boolean[] = new Array(candidates.length).fill(false)
  const concurrency = 3
  for (let i = 0; i < candidates.length; i += concurrency) {
    const slice = candidates.slice(i, i + concurrency)
    const flags = await Promise.all(slice.map((c) => preloadJpeg(c.jpegUrl)))
    flags.forEach((f, j) => {
      ok[i + j] = f
    })
  }

  const stamps = candidates.filter((_, i) => ok[i])
  if (stamps.length < 2) {
    throw new Error(
      `Sin suficientes épocas WiseView precargadas (${stamps.length}/${candidates.length}).`,
    )
  }
  return stamps
}
