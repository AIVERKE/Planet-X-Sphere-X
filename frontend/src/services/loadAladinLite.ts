/**
 * Carga diferida de Aladin Lite + red endurecida.
 *
 * 1) Telemetría CDS (`alasky.unistra.fr`) ya no resuelve → silenciada.
 * 2) HiPS se sirve por proxy Vite (`/hips/...`) same-origin para que los tiles pinten.
 */

export type AladinInstance = {
  setFoV: (fov: number) => void
  setFov?: (fov: number) => void
  gotoRaDec: (ra: number, dec: number) => void
  setImageSurvey: (survey: string | object) => void
  setBaseImageLayer?: (survey: string | object) => void
  createImageSurvey?: (
    id: string,
    name: string | undefined,
    url: string,
    cooFrame: string | undefined,
    maxOrder: number | undefined,
    options?: Record<string, unknown>,
  ) => object
  getRaDec: () => [number, number]
  getFov: () => number[]
  createImageFITS?: (
    url: string,
    options?: { name?: string },
    success?: (ra: number, dec: number, fov: number) => void,
    error?: (err: unknown) => void,
  ) => object
  setOverlayImageLayer?: (image: object, name?: string) => void
  removeImageLayer?: (name: string) => void
  remove?: () => void
  view?: { requestRedraw?: () => void; setViewSize?: (w: number, h: number) => void }
}

export type AladinAPI = {
  init: Promise<void> | (() => Promise<void>)
  aladin: (
    target: string | HTMLElement,
    options?: Record<string, unknown>,
  ) => AladinInstance
  HiPS?: (idOrUrl: string, options?: Record<string, unknown>) => object
  imageHiPS?: (idOrUrl: string, options?: Record<string, unknown>) => object
}

/** Surveys servidos por el proxy de Vite (mismo origen que la app). */
export const LOCAL_HIPS = {
  'esa-dss': {
    id: 'local/esa-dss',
    label: 'DSS ESA · HD',
    url: '/hips/esa-dss',
  },
  'dss2-color': {
    id: 'local/irsa-dss',
    label: 'DSS2 IRSA · HD',
    url: '/hips/irsa-dss',
  },
  '2mass': {
    id: 'local/irsa-2mass',
    label: '2MASS IR',
    url: '/hips/irsa-2mass',
  },
} as const

export type LocalHipsId = keyof typeof LOCAL_HIPS

/**
 * Mapa base al visitar un preset.
 * Los campos amplios van por IRSA. El resto prefiere ESA (más nítido), salvo que ESA no
 * haya respondido al arrancar: pedirle tiles a un host caído deja el cielo negro.
 */
export function presetSurvey(category: string, esaReachable: boolean): LocalHipsId {
  if (category === 'survey_field' || !esaReachable) return 'dss2-color'
  return 'esa-dss'
}

let pending: Promise<AladinAPI> | null = null
let networkPatched = false

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return ''
}

function isBrokenCdsHost(url: string): boolean {
  return (
    url.includes('AladinLiteLogger') ||
    url.includes('alasky.unistra.fr') ||
    url.includes('alasky.u-strasbg.fr') ||
    url.includes('alaskybis.unistra.fr') ||
    url.includes('alaskybis.u-strasbg.fr')
  )
}

/** Bloquea hosts CDS muertos y evita Uncaught Failed to fetch. */
export function patchAladinNetwork() {
  if (networkPatched || typeof window === 'undefined') return
  networkPatched = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input)
    if (isBrokenCdsHost(url)) {
      // 204 no admite cuerpo: `new Response('{}', { status: 204 })` lanza TypeError.
      return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }))
    }
    return originalFetch(input, init)
  }
}

async function awaitInit(A: AladinAPI) {
  const init = A.init
  if (typeof init === 'function') {
    await init()
    return
  }
  await init
}

export function loadAladinLite(): Promise<AladinAPI> {
  if (!pending) {
    patchAladinNetwork()
    pending = import('aladin-lite')
      .then(async (mod) => {
        const A = (mod.default ?? mod) as AladinAPI
        if (typeof A.aladin !== 'function') {
          throw new Error('Aladin Lite no expuso A.aladin')
        }
        await awaitInit(A)
        return A
      })
      .catch((error) => {
        pending = null
        throw error
      })
  }
  return pending
}

export function setAladinFoV(aladin: AladinInstance, fov: number) {
  if (typeof aladin.setFoV === 'function') {
    aladin.setFoV(fov)
    return
  }
  aladin.setFov?.(fov)
}

export function refreshAladinView(aladin: AladinInstance, host?: HTMLElement | null) {
  try {
    if (host && aladin.view?.setViewSize) {
      const rect = host.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        aladin.view.setViewSize(Math.floor(rect.width), Math.floor(rect.height))
      }
    }
  } catch {
    /* ignore */
  }
  try {
    aladin.view?.requestRedraw?.()
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event('resize'))
  } catch {
    /* ignore */
  }
}

/** Crea un HiPS con formato explícito (jpeg) y URL same-origin. */
export function buildLocalHips(
  A: AladinAPI,
  aladin: AladinInstance,
  hipsKey: LocalHipsId,
): string | object {
  const meta = LOCAL_HIPS[hipsKey]
  const options = {
    name: meta.label,
    url: meta.url,
    imgFormat: 'jpeg',
    maxOrder: 9,
    tileSize: 512,
    cooFrame: 'icrs',
  }

  if (typeof A.HiPS === 'function') {
    return A.HiPS(meta.id, options)
  }
  if (typeof A.imageHiPS === 'function') {
    return A.imageHiPS(meta.id, options)
  }
  if (typeof aladin.createImageSurvey === 'function') {
    return aladin.createImageSurvey(meta.id, meta.label, meta.url, 'icrs', 9, options)
  }
  return meta.url
}

export function applyLocalHips(
  A: AladinAPI,
  aladin: AladinInstance,
  hipsKey: LocalHipsId,
) {
  const hips = buildLocalHips(A, aladin, hipsKey)
  if (typeof aladin.setBaseImageLayer === 'function') {
    aladin.setBaseImageLayer(hips)
  } else {
    aladin.setImageSurvey(hips)
  }
}
