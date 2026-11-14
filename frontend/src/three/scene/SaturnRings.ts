import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  ShaderMaterial,
  type Texture,
} from 'three'
import { getSaturnRingMap } from '@/three/textures/planetMaps'

const fallbackVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fallbackFragment = /* glsl */ `
varying vec2 vUv;
void main() {
  float stripes = sin(vUv.y * 86.0) * 0.5 + 0.5;
  float gap = smoothstep(0.035, 0.0, abs(vUv.y - 0.56));
  float fade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  float alpha = (0.22 + stripes * 0.55) * fade * (1.0 - gap * 0.82);
  gl_FragColor = vec4(vec3(0.9, 0.82, 0.66), alpha);
}
`

export function createSaturnRings(radius: number, map?: Texture | null) {
  const texture = map ?? getSaturnRingMap()
  const material = texture
    ? new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
        alphaTest: 0.02,
      })
    : new ShaderMaterial({
        vertexShader: fallbackVertex,
        fragmentShader: fallbackFragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      })

  const mesh = new Mesh(new RingGeometry(radius * 1.35, radius * 2.25, 96, 4), material)
  mesh.rotation.x = Math.PI * 0.46
  mesh.name = 'saturn-rings'
  return mesh
}
