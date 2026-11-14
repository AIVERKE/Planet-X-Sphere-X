import type { Planet } from '@/types/explorer'
import { createPlanetBody } from '@/three/scene/PlanetBody'

/** Tierra con textura diurna; sin atmósfera Fresnel ni capa extra. */
export function createEarthGlobe(planet: Planet) {
  return createPlanetBody(planet)
}
