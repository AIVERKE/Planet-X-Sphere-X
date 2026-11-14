import { Mesh, PlaneGeometry } from 'three'
import { createTerrainMaterial } from '@/three/materials/fbmSurface'

export function createTerrain() {
  const material = createTerrainMaterial()
  const mesh = new Mesh(new PlaneGeometry(72, 72, 140, 140), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.name = 'terrain'
  mesh.frustumCulled = false
  return { mesh, material }
}
