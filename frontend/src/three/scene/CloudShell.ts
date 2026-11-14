import { Mesh, PlaneGeometry } from 'three'
import { createFogMaterial } from '@/three/materials/fogPlanes'

const PLANE_LAYOUT = [
  { position: [0, 4.2, 9], scale: [34, 16, 1] },
  { position: [2, 6.4, 3], scale: [42, 18, 1] },
  { position: [-3, 7.2, -4], scale: [48, 20, 1] },
  { position: [0, 5.5, 14], scale: [30, 12, 1] },
] as const

export function createCloudShell() {
  const material = createFogMaterial('#e7e0d2')
  const planes = PLANE_LAYOUT.map((layout, index) => {
    const mesh = new Mesh(new PlaneGeometry(1, 1), material)
    mesh.position.set(layout.position[0], layout.position[1], layout.position[2])
    mesh.scale.set(layout.scale[0], layout.scale[1], layout.scale[2])
    mesh.renderOrder = 4
    mesh.name = `fog-${index}`
    return mesh
  })
  return { planes, material }
}
