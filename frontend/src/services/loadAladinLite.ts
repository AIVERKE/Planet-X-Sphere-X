/**
 * Carga diferida de Aladin Lite (paquete npm `aladin-lite`).
 * Solo se descarga/parsea al abrir la misión (dynamic import → chunk aparte).
 *
 * En aladin-lite v3, `A.init` ya es una Promise (IIFE), no una función:
 *   A.init.then(() => A.aladin(...))
 */

export type AladinInstance = {
  setFov: (fov: number) => void
  gotoRaDec: (ra: number, dec: number) => void
  setImageSurvey: (id: string) => void
  getRaDec: () => [number, number]
  getFov: () => number[]
  remove?: () => void
}

export type AladinAPI = {
  /** Promise lista tras WASM/WebGL2 (v3). En algunas builds puede ser función. */
  init: Promise<void> | (() => Promise<void>)
  aladin: (
    target: string | HTMLElement,
    options?: Record<string, unknown>,
  ) => AladinInstance
}

let pending: Promise<AladinAPI> | null = null

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
