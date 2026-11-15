import { Group, Mesh, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector2, Vector3 } from 'three'
import jupiterUrl from '@/assets/images/1k_jupiter.jpg?url'
import { buildStarfield } from './points'
import type { ShapeBuilder } from './types'

/**
 * Júpiter (referencia: Hubble/Cassini; textura 1k derivada de 2k_jupiter.jpg, 67 KB).
 * Señales: bandas horizontales, Gran Mancha Roja, terminador iluminado por una luz
 * direccional y polos levemente achatados. Gira rápido (un día joviano dura ~10 h).
 */

/** Posición de la Gran Mancha Roja en la textura (uv, medida sobre 1k_jupiter.jpg). */
const GRS = new Vector2(0.366, 0.395)
/** rad/s: una vuelta cada ~18 s. */
const SPIN = 0.35
/** Acimut de la mancha en el cuadro estático: un poco hacia el lado iluminado. */
const STILL_AZIMUTH = -0.35
/** Achatamiento real ≈ 0.065. */
const OBLATENESS = 0.065

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
uniform sampler2D uMap;
uniform vec3 uLight;
uniform vec3 uHaze;
uniform vec2 uSpot;

void main() {
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(-vViewPos);
  vec3 tex = texture2D(uMap, vUv).rgb;

  // Gran Mancha Roja: óvalo más rojo y saturado, con un collar algo más oscuro.
  vec2 d = (vUv - uSpot) / vec2(0.032, 0.03);
  float r2 = dot(d, d);
  float spot = exp(-r2 * 1.4);
  float collar = exp(-pow(sqrt(r2) - 1.2, 2.0) * 10.0);
  tex = mix(tex, tex * vec3(1.3, 0.62, 0.46), spot * 0.9);
  tex *= 1.0 - collar * 0.2;

  // Luz direccional con terminador suave y oscurecimiento del limbo.
  float ndl = dot(n, uLight);
  float ndv = max(dot(n, v), 0.0);
  float light = smoothstep(-0.12, 0.3, ndl) * mix(0.5, 1.0, clamp(ndl, 0.0, 1.0));
  float limb = mix(0.55, 1.0, pow(ndv, 0.45));
  vec3 col = tex * (light * limb * 1.18 + 0.025);

  // Bruma fina en el limbo iluminado.
  float rim = pow(1.0 - ndv, 3.0) * smoothstep(-0.1, 0.45, ndl);
  col += uHaze * rim * 0.22;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export const buildJupiter: ShapeBuilder = (ctx) => {
  const root = new Group()
  root.name = 'jupiter'
  root.add(buildStarfield(ctx))

  const body = new Group()
  body.rotation.z = 0.05
  root.add(body)

  const geometry = ctx.keep(new SphereGeometry(1, 96, 64))
  const map = ctx.keep(
    ctx.loadTexture(jupiterUrl, () => {
      planet.visible = true
      ctx.invalidate()
    }),
  )
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 4

  const material = ctx.keep(
    new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMap: { value: map },
        uLight: { value: new Vector3(-0.62, 0.22, 0.75).normalize() },
        uHaze: { value: ctx.colors[2] },
        uSpot: { value: GRS },
      },
    }),
  )
  // Oculto hasta que la textura carga: nunca se ve una esfera vacía.
  const planet = new Mesh(geometry, material)
  planet.visible = false
  planet.scale.set(1, 1 - OBLATENESS, 1)
  body.add(planet)

  // rotation.y que deja la mancha en STILL_AZIMUTH (u → acimut φ = 2π·u − π/2).
  const base = STILL_AZIMUTH - (GRS.x * Math.PI * 2 - Math.PI / 2)

  return {
    object: root,
    cameraZ: 4.5,
    stillTime: 0,
    update(t) {
      planet.rotation.y = base + t * SPIN
    },
  }
}
