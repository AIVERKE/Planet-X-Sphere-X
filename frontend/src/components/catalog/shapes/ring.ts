import { AdditiveBlending, Color, Group, Mesh, ShaderMaterial, SphereGeometry } from 'three'
import { NOISE_GLSL } from '@/three/materials/noise.glsl'
import { buildStarfield, emptyCloud, makePoints, pushPoint } from './points'
import type { ShapeBuilder, ShapeContext } from './types'

/** Inclinación de la elipse en pantalla (rad), tomada de la foto de referencia. */
const ROLL = -0.45

/**
 * Nebulosa planetaria (referencia: M57, Nebulosa del Anillo).
 * Señales: cáscara simétrica con el borde más brillante (limb), centro casi vacío
 * y una estrella central puntual. La oscilación lenta deja ver que es una burbuja.
 *
 * El brillo es la longitud que recorre cada rayo dentro de una cáscara gruesa
 * (elipsoide exterior menos elipsoide interior), calculada de forma analítica:
 * máximo al rozar el borde interior y cero en el centro, como una burbuja real.
 */

const vertexShader = /* glsl */ `
varying vec3 vOrigin;
varying vec3 vRay;
void main() {
  // Rayo en espacio objeto (esfera unidad); la escala del mesh la vuelve elipsoide.
  vOrigin = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vRay = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
${NOISE_GLSL}
varying vec3 vOrigin;
varying vec3 vRay;
uniform float uTime;
uniform float uInnerRadius;
uniform float uGain;
uniform float uFill;
uniform float uKnots;
uniform vec3 uInner;
uniform vec3 uMid;
uniform vec3 uOuter;

vec2 sphereHit(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float h = b * b - (dot(ro, ro) - r * r);
  if (h < 0.0) return vec2(0.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  vec3 rd = normalize(vRay);
  vec2 outer = sphereHit(vOrigin, rd, 1.0);
  vec2 inner = sphereHit(vOrigin, rd, uInnerRadius);
  float cavity = inner.y - inner.x;
  float path = (outer.y - outer.x) - cavity;
  float peak = 2.0 * sqrt(1.0 - uInnerRadius * uInnerRadius);
  float shell = clamp(path / peak, 0.0, 1.0);
  if (shell <= 0.001) discard;

  // Nudos y filamentos sobre la cáscara, evaluados en el punto de entrada del rayo.
  vec3 entry = vOrigin + rd * outer.x;
  float knots = mix(1.0, 0.35 + 1.1 * fbm(entry * 4.2 + vec3(0.0, 0.0, uTime * 0.02)), uKnots);

  // Distancia del rayo al centro (0 = centro, 1 = borde): tiñe de dentro hacia fuera.
  float rho = length(cross(vOrigin, rd));
  vec3 col = mix(uInner, uMid, smoothstep(uInnerRadius - 0.25, uInnerRadius + 0.05, rho));
  col = mix(col, uOuter, smoothstep(uInnerRadius + 0.12, 0.98, rho));

  float glow = shell * shell * knots * uGain + (cavity / (2.0 * uInnerRadius)) * uFill;
  gl_FragColor = vec4(col, clamp(glow, 0.0, 1.0));
  #include <colorspace_fragment>
}
`

interface ShellOptions {
  innerRadius: number
  gain: number
  fill: number
  knots: number
  inner: Color
  mid: Color
  outer: Color
}

function shellMaterial(ctx: ShapeContext, options: ShellOptions) {
  return ctx.keep(
    new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: ctx.time,
        uInnerRadius: { value: options.innerRadius },
        uGain: { value: options.gain },
        uFill: { value: options.fill },
        uKnots: { value: options.knots },
        uInner: { value: options.inner },
        uMid: { value: options.mid },
        uOuter: { value: options.outer },
      },
    }),
  )
}

export const buildRing: ShapeBuilder = (ctx) => {
  const [cyan, blue, orange] = ctx.colors
  const root = new Group()
  root.name = 'ring'
  root.add(buildStarfield(ctx))

  const nebula = new Group()
  // Elipse inclinada como en la foto de M57.
  nebula.rotation.z = ROLL
  root.add(nebula)

  const sphere = ctx.keep(new SphereGeometry(1, 64, 40))

  // Cáscara principal: gruesa y alargada sobre la línea de visión (barril), por eso se ve anillo.
  const shell = new Mesh(
    sphere,
    shellMaterial(ctx, { innerRadius: 0.6, gain: 1.15, fill: 0.3, knots: 0.75, inner: blue, mid: cyan, outer: orange }),
  )
  shell.scale.set(0.74, 0.58, 0.9)

  // Borde exterior difuso: naranja tenue y grumoso que deshilacha el contorno.
  const halo = new Mesh(
    sphere,
    shellMaterial(ctx, { innerRadius: 0.74, gain: 0.4, fill: 0, knots: 1, inner: orange, mid: orange, outer: orange }),
  )
  halo.scale.set(0.88, 0.71, 1.0)

  nebula.add(halo, shell)

  // Estrella central: punto pequeño, blanco-azulado, siempre por encima.
  const core = emptyCloud()
  pushPoint(core, 0, 0, 0, new Color('#9fdcff').multiplyScalar(0.35), 0.16)
  pushPoint(core, 0, 0, 0, new Color('#f4f8ff'), 0.055)
  const star = makePoints(ctx, core, { falloff: 8, depthTest: false })
  star.renderOrder = 10
  nebula.add(star)

  return {
    object: root,
    cameraZ: 3.8,
    stillTime: 0,
    update(t) {
      // Los nudos se mueven en el shader (uTime); aquí solo la oscilación que delata la burbuja.
      nebula.rotation.y = Math.sin(t * 0.22) * 0.55
      nebula.rotation.x = Math.sin(t * 0.17) * 0.18
    },
  }
}
