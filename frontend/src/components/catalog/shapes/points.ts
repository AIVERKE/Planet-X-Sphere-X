import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  type Blending,
} from 'three'
import type { ShapeContext } from './types'

/** RNG determinista (mulberry32): cada forma se ve igual en cada visita. */
export function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normal estándar (Box-Muller). */
export function gauss(random: () => number) {
  const u = Math.max(random(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

/** Disco suave calculado con gl_PointCoord: sin textura. */
export const POINT_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
uniform float uFalloff;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float a = (exp(-r2 * uFalloff) + 0.18 * exp(-r2 * 2.2)) * (1.0 - r2) * vAlpha;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}
`

/** Tamaño en unidades de mundo: uScale = alto del buffer / (2·tan(fov/2)). */
export const POINT_SIZE_GLSL = /* glsl */ `
uniform float uScale;
float pointSize(float size, vec4 mv) {
  return max(size * uScale / max(-mv.z, 0.001), 1.0);
}
`

const STATIC_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
${POINT_SIZE_GLSL}
void main() {
  vColor = aColor;
  vAlpha = uOpacity;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = pointSize(aSize, mv);
  gl_Position = projectionMatrix * mv;
}
`

export interface PointCloud {
  positions: number[]
  colors: number[]
  sizes: number[]
}

export function emptyCloud(): PointCloud {
  return { positions: [], colors: [], sizes: [] }
}

export function pushPoint(cloud: PointCloud, x: number, y: number, z: number, color: Color, size: number) {
  cloud.positions.push(x, y, z)
  cloud.colors.push(color.r, color.g, color.b)
  cloud.sizes.push(size)
}

interface PointOptions {
  blending?: Blending
  falloff?: number
  opacity?: number
  depthTest?: boolean
}

/** Nube de puntos estática con el material compartido; todo queda registrado con keep(). */
export function makePoints(ctx: ShapeContext, cloud: PointCloud, options: PointOptions = {}) {
  const geometry = ctx.keep(new BufferGeometry())
  geometry.setAttribute('position', new Float32BufferAttribute(cloud.positions, 3))
  geometry.setAttribute('aColor', new Float32BufferAttribute(cloud.colors, 3))
  geometry.setAttribute('aSize', new Float32BufferAttribute(cloud.sizes, 1))
  const material = ctx.keep(
    new ShaderMaterial({
      vertexShader: STATIC_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: options.depthTest ?? true,
      blending: options.blending ?? AdditiveBlending,
      uniforms: {
        uScale: ctx.pointScale,
        uFalloff: { value: options.falloff ?? 6 },
        uOpacity: { value: options.opacity ?? 1 },
      },
    }),
  )
  return new Points(geometry, material)
}

/** Fondo de estrellas lejanas, común a todas las formas. */
export function buildStarfield(ctx: ShapeContext, count = 220) {
  const random = seeded(7)
  const cloud = emptyCloud()
  const warm = new Color('#fff1dc')
  const cool = new Color('#dfe8ff')
  const tint = new Color()
  for (let i = 0; i < count; i += 1) {
    const radius = 6 + random() * 3
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    tint.copy(warm).lerp(cool, random()).multiplyScalar(0.55 + random() * 0.45)
    pushPoint(
      cloud,
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta) * 0.72,
      -Math.abs(radius * Math.cos(phi)),
      tint,
      0.03 + random() * random() * 0.06,
    )
  }
  const stars = makePoints(ctx, cloud, { falloff: 7 })
  stars.name = 'starfield'
  stars.renderOrder = -10
  return stars
}
