import { Color, MeshStandardMaterial, type Texture } from 'three'

export function createTexturedPlanetMaterial(
  texture: Texture,
  options?: { emissive?: boolean },
) {
  if (options?.emissive) {
    return new MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new Color('#ffffff'),
      emissiveIntensity: 1.35,
      roughness: 1,
      metalness: 0,
      toneMapped: true,
    })
  }

  return new MeshStandardMaterial({
    map: texture,
    roughness: 0.92,
    metalness: 0.04,
    toneMapped: true,
  })
}
