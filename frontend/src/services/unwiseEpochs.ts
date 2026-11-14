/**
 * Cutouts unWISE multi-época vía Legacy Survey (JPEG limpio).
 * Blink entre NEO2…NEO11 ≈ movimiento propio tipo WiseView, mejor renderizado.
 * https://www.legacysurvey.org/viewer/
 */

export type EpochStamp = {
  id: string
  label: string
  filter: string
  jpegUrl: string
  fitsUrl: string
  yearHint: string
}

/** Capas NEO con línea de tiempo creciente (W1/W2 color). */
const UNWISE_EPOCHS = [
  { id: 'neo2', layer: 'unwise-neo2', label: 'NEO2', yearHint: '~2010–14' },
  { id: 'neo3', layer: 'unwise-neo3', label: 'NEO3', yearHint: '~2010–15' },
  { id: 'neo4', layer: 'unwise-neo4', label: 'NEO4', yearHint: '~2010–17' },
  { id: 'neo6', layer: 'unwise-neo6', label: 'NEO6', yearHint: '~2010–19' },
  { id: 'neo7', layer: 'unwise-neo7', label: 'NEO7', yearHint: '~2010–20' },
  { id: 'neo11', layer: 'unwise-neo11', label: 'NEO11', yearHint: '~2010–23' },
] as const

const LS = 'https://www.legacysurvey.org/viewer'

/** unWISE nativo ≈ 2.75″/px; size en píxeles del JPEG. */
export function unwiseEpochCutoutUrl(
  ra: number,
  dec: number,
  layer: string,
  size = 280,
  pixscale = 2.75,
): string {
  const params = new URLSearchParams({
    ra: String(ra),
    dec: String(dec),
    layer,
    pixscale: String(pixscale),
    size: String(size),
  })
  return `${LS}/cutout.jpg?${params.toString()}`
}

export function wiseviewPortalUrl(ra: number, dec: number, sizeArcsec = 176): string {
  const params = new URLSearchParams({
    ra: String(ra),
    dec: String(dec),
    size: String(sizeArcsec),
    band: '3',
  })
  return `https://byw.tools/wiseview?${params.toString()}`
}

function preloadJpeg(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 8 && img.naturalHeight > 8)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

/** Arma sellos por época y descarta capas que no carguen. */
export async function fetchUnwiseEpochStamps(
  ra: number,
  dec: number,
  size = 280,
): Promise<EpochStamp[]> {
  const candidates = UNWISE_EPOCHS.map((ep) => {
    const jpegUrl = unwiseEpochCutoutUrl(ra, dec, ep.layer, size)
    return {
      id: ep.id,
      label: ep.label,
      filter: ep.layer,
      jpegUrl,
      fitsUrl: jpegUrl.replace('/cutout.jpg?', '/cutout.fits?'),
      yearHint: ep.yearHint,
    } satisfies EpochStamp
  })

  const ok = await Promise.all(candidates.map((c) => preloadJpeg(c.jpegUrl)))
  const stamps = candidates.filter((_, i) => ok[i])
  if (stamps.length < 2) {
    throw new Error('Sin suficientes épocas unWISE para blink de movimiento')
  }
  return stamps
}
