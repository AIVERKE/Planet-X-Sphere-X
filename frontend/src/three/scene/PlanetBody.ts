import {
  Group,
  Mesh,
  Object3D,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three'
import type { Planet } from '@/types/explorer'
import { visualRadiusOf } from '@/data/planets'
import { createPlanetMaterial, planetKind } from '@/three/materials/fbmSurface'
import { createTexturedPlanetMaterial } from '@/three/materials/texturedPlanet'
import { createSaturnRings } from '@/three/scene/SaturnRings'
import { getPlanetMap } from '@/three/textures/planetMaps'

export function createPlanetBody(planet: Planet) {
  const radius = visualRadiusOf(planet)
  const group = new Group()
  group.name = planet.id
  group.userData.visualRadius = radius
  group.position.set(...planet.orbitPosition)

  const map = getPlanetMap(planet.mapId)
  const material: Material = map
    ? createTexturedPlanetMaterial(map, { emissive: planet.mapId === 'sun' })
    : createPlanetMaterial({
        colors: planet.colors,
        seed: planet.seed,
        kind: planetKind(planet.id, planet.bands),
        bands: planet.bands,
      })

  const surface = new Mesh(new SphereGeometry(radius, 48, 32), material)
  surface.name = `${planet.id}-surface`
  group.add(surface)

  if (planet.rings) group.add(createSaturnRings(radius))

  for (const hotspot of planet.hotspots) {
    const anchor = new Object3D()
    anchor.name = hotspot.id
    anchor.position.copy(new Vector3(...hotspot.position).normalize().multiplyScalar(radius * 1.02))
    group.add(anchor)
  }

  return { group, material }
}
