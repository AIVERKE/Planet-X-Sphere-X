import {
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  type MeshBasicMaterial as MeshBasicMaterialType,
  type Texture,
} from 'three'
import { markRaw } from 'vue'
import milkyWayUrl from '@/assets/images/8k_stars_milky_way.jpg?url'

export interface SpaceBackground {
  mesh: Mesh
  material: MeshBasicMaterialType
  texture: Texture
  setOpacity: (value: number) => void
  dispose: () => void
}

/** Cielo de estrellas / Vía Láctea para la fase espacial. */
export async function loadMilkyWayBackground(): Promise<SpaceBackground> {
  const loader = new TextureLoader()
  const texture = await loader.loadAsync(milkyWayUrl)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true

  const material = new MeshBasicMaterial({
    map: texture,
    side: FrontSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  })

  const mesh = new Mesh(new SphereGeometry(220, 48, 28), material)
  mesh.geometry.scale(-1, 1, 1)
  mesh.frustumCulled = false
  mesh.renderOrder = -15
  mesh.name = 'milky-way'
  mesh.visible = false

  return {
    mesh: markRaw(mesh),
    material,
    texture: markRaw(texture),
    setOpacity(value: number) {
      const opacity = Math.min(1, Math.max(0, value))
      material.opacity = opacity
      mesh.visible = opacity > 0.01
    },
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}

/** Compat: ya no usamos Points; el fondo texturizado se carga con loadMilkyWayBackground. */
export function createStarfield() {
  return {
    stars: null as Mesh | null,
    nebulas: [] as never[],
  }
}
