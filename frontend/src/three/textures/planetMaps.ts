import earthDayUrl from '@/assets/images/2k_earth_daymap.jpg?url'
import jupiterUrl from '@/assets/images/2k_jupiter.jpg?url'
import marsUrl from '@/assets/images/2k_mars.jpg?url'
import mercuryUrl from '@/assets/images/2k_mercury.jpg?url'
import moonUrl from '@/assets/images/2k_moon.jpg?url'
import neptuneUrl from '@/assets/images/2k_neptune.jpg?url'
import saturnUrl from '@/assets/images/2k_saturn.jpg?url'
import saturnRingUrl from '@/assets/images/2k_saturn_ring_alpha.png?url'
import sunUrl from '@/assets/images/2k_sun.jpg?url'
import uranusUrl from '@/assets/images/2k_uranus.jpg?url'
import venusUrl from '@/assets/images/2k_venus_surface.jpg?url'
import {
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three'
import { markRaw } from 'vue'
import type { PlanetMapId } from '@/types/explorer'

const MAP_URLS: Record<PlanetMapId, string> = {
  earth: earthDayUrl,
  mars: marsUrl,
  jupiter: jupiterUrl,
  saturn: saturnUrl,
  mercury: mercuryUrl,
  venus: venusUrl,
  uranus: uranusUrl,
  neptune: neptuneUrl,
  sun: sunUrl,
  moon: moonUrl,
}

const cache = new Map<string, Texture>()
let ringTexture: Texture | null = null
let loading: Promise<void> | null = null

function prepare(texture: Texture, anisotropic = 4) {
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = anisotropic
  texture.needsUpdate = true
  return markRaw(texture)
}

export function preloadPlanetTextures() {
  if (loading) return loading
  const loader = new TextureLoader()
  loading = Promise.all([
    ...Object.entries(MAP_URLS).map(async ([id, url]) => {
      const texture = prepare(await loader.loadAsync(url))
      cache.set(id, texture)
    }),
    loader.loadAsync(saturnRingUrl).then((texture) => {
      texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
      ringTexture = markRaw(texture)
    }),
  ]).then(() => undefined)
  return loading
}

export function getPlanetMap(id: PlanetMapId | undefined) {
  if (!id) return null
  return cache.get(id) ?? null
}

export function getSaturnRingMap() {
  return ringTexture
}
