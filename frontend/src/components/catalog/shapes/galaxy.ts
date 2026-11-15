import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  NormalBlending,
  Points,
  ShaderMaterial,
} from 'three'
import { buildStarfield, emptyCloud, gauss, makePoints, POINT_FRAGMENT, POINT_SIZE_GLSL, pushPoint, seeded } from './points'
import type { ShapeBuilder } from './types'

/**
 * Galaxia espiral (referencia: M31, Andrómeda, con sus satélites M32 y M110).
 * Señales: dos brazos en espiral logarítmica azulados, núcleo denso y amarillento,
 * bandas de polvo en el borde interior de los brazos, rotación diferencial.
 *
 * Cada estrella recorre una elipse (onda de densidad): las elipses giran según
 * φ(a) = K·ln(a/A0) y no cambian con el tiempo, así que la cresta θ = 0/π traza
 * dos espirales logarítmicas fijas por las que las estrellas fluyen. El centro
 * gira más rápido (ω ∝ 1/a) sin que los brazos se enrollen.
 */

const BULGE = 3000
const DISK = 8000
const GLOW = 3200
const HII = 500
const DUST = 900
const A0 = 0.06
/** Espiral más cerrada que la de M81: los brazos de M31 se ven como arcos. */
const K = 3.8
/**
 * M31 está a ~77° y el ticket pide ~60°: 70° conserva los brazos visibles y se acerca
 * al óvalo alargado de la foto.
 */
const INCLINATION = (70 * Math.PI) / 180
/** Eje mayor en diagonal, como en la foto de referencia. */
const POSITION_ANGLE = -0.84
const PATTERN_SPEED = 0.035

const orbitVertex = /* glsl */ `
attribute vec4 aOrbit;
attribute float aSpeed;
attribute float aHeight;
attribute vec3 aColor;
attribute float aSize;
attribute float aArm;
attribute float aBright;
uniform float uTime;
uniform vec3 uInter;
varying vec3 vColor;
varying float vAlpha;
${POINT_SIZE_GLSL}
void main() {
  float theta = aOrbit.w + uTime * aSpeed;
  float c = cos(theta);
  vec2 e = vec2(c, sin(theta) * aOrbit.y) * aOrbit.x;
  float cp = cos(aOrbit.z);
  float sp = sin(aOrbit.z);
  vec3 p = vec3(e.x * cp - e.y * sp, aHeight, e.x * sp + e.y * cp);

  // Los brazos se marcan sobre todo en el disco exterior; dentro domina el brillo suave del bulbo.
  float crest = pow(abs(c), 6.0) * smoothstep(0.2, 0.55, aOrbit.x);
  vec3 col = aColor;
  float gate = 1.0;
  float size = aSize;
  if (aArm > 1.5) {
    gate = smoothstep(0.45, 0.95, crest);
  } else if (aArm > 0.5) {
    gate = mix(0.45, 1.0, crest);
    col = mix(uInter, aColor, crest);
    size *= 1.0 + 0.6 * crest;
  }
  vColor = col;
  vAlpha = gate * aBright;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = pointSize(size, mv);
  gl_Position = projectionMatrix * mv;
}
`

function armAngle(a: number) {
  return K * Math.log(a / A0)
}

function axisRatio(a: number) {
  const rise = Math.min(Math.max((a - 0.08) / 0.22, 0), 1)
  const fade = Math.min(Math.max((a - 0.75) / 0.25, 0), 1)
  return 1 - 0.26 * rise * (1 - 0.5 * fade)
}

/** Velocidad angular: negativa para que los brazos queden "trailing" con el giro del patrón. */
function angularSpeed(a: number) {
  return -0.075 / (a + 0.07)
}

export const buildGalaxy: ShapeBuilder = (ctx) => {
  const random = seeded(81)
  const [cream, blue, dustColor] = ctx.colors

  const root = new Group()
  root.name = 'galaxy'
  root.add(buildStarfield(ctx))

  const frame = new Group()
  frame.rotation.z = POSITION_ANGLE
  const incline = new Group()
  incline.rotation.x = Math.PI / 2 - INCLINATION
  const spin = new Group()
  frame.add(incline)
  incline.add(spin)
  root.add(frame)

  // --- Estrellas en órbita: bulbo + disco + regiones HII ---
  const total = BULGE + DISK + GLOW + HII
  const position = new Float32Array(total * 3)
  const orbit = new Float32Array(total * 4)
  const speed = new Float32Array(total)
  const height = new Float32Array(total)
  const color = new Float32Array(total * 3)
  const size = new Float32Array(total)
  const arm = new Float32Array(total)
  const bright = new Float32Array(total)

  const warm = new Color('#ffd08a')
  const pink = new Color('#ff7aa6')
  const white = new Color('#ffffff')
  const deep = new Color('#5c7dff')
  const tint = new Color()

  let index = 0
  const add = (a: number, q: number, phi: number, y: number, kind: number, starSize: number, alpha = 1) => {
    const theta = random() * Math.PI * 2
    orbit.set([a, q, phi, theta], index * 4)
    speed[index] = angularSpeed(a)
    height[index] = y
    color.set([tint.r, tint.g, tint.b], index * 3)
    size[index] = starSize
    arm[index] = kind
    bright[index] = alpha
    const ex = Math.cos(theta) * a
    const ey = Math.sin(theta) * a * q
    position.set(
      [ex * Math.cos(phi) - ey * Math.sin(phi), y, ex * Math.sin(phi) + ey * Math.cos(phi)],
      index * 3,
    )
    index += 1
  }

  for (let i = 0; i < BULGE; i += 1) {
    const a = Math.min(Math.abs(gauss(random)) * 0.14 + 0.004, 0.5)
    tint.copy(warm).lerp(cream, random() * 0.6)
    add(a, 0.82 + random() * 0.12, random() * Math.PI * 2, gauss(random) * 0.055 * (1 - a), 0, 0.016 + random() * 0.016, 0.1 + random() * 0.12)
  }

  const diskRadius = () => {
    let a = 2
    // Disco exponencial corto: la luz se concentra hacia el centro, como en M31.
    while (a > 1 || a < 0.1) a = -0.23 * Math.log(Math.max(random() * random(), 1e-9))
    return a
  }

  // Las zonas densas (centro) llevan estrellas más tenues para que el aditivo no queme en blanco.
  const density = (a: number) => 0.18 + 0.82 * Math.min(Math.max((a - 0.1) / 0.6, 0), 1)

  for (let i = 0; i < DISK; i += 1) {
    const a = diskRadius()
    const old = random() < 0.15
    tint.copy(old ? cream : blue).lerp(deep, old ? 0 : 0.3 + random() * 0.5)
    const phi = armAngle(a) + gauss(random) * 0.18
    add(a, axisRatio(a), phi, gauss(random) * (0.012 + 0.02 * (1 - a)), 1, 0.011 + random() * random() * 0.02, (0.18 + random() * 0.2) * density(a))
  }

  // Luz difusa de los brazos: puntos grandes y tenues que funden las estrellas en un brillo continuo.
  for (let i = 0; i < GLOW; i += 1) {
    const a = diskRadius()
    tint.copy(blue).lerp(cream, 0.25 + random() * 0.3)
    const phi = armAngle(a) + gauss(random) * 0.2
    add(a, axisRatio(a), phi, gauss(random) * 0.015, 1, 0.08 + random() * 0.07, (0.1 + random() * 0.08) * density(a))
  }

  for (let i = 0; i < HII; i += 1) {
    const a = 0.22 + random() * 0.68
    tint.copy(pink).lerp(white, random() * 0.25)
    add(a, axisRatio(a), armAngle(a) + gauss(random) * 0.1, gauss(random) * 0.01, 2, 0.016 + random() * 0.018, 0.8)
  }

  const geometry = ctx.keep(new BufferGeometry())
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('aOrbit', new Float32BufferAttribute(orbit, 4))
  geometry.setAttribute('aSpeed', new Float32BufferAttribute(speed, 1))
  geometry.setAttribute('aHeight', new Float32BufferAttribute(height, 1))
  geometry.setAttribute('aColor', new Float32BufferAttribute(color, 3))
  geometry.setAttribute('aSize', new Float32BufferAttribute(size, 1))
  geometry.setAttribute('aArm', new Float32BufferAttribute(arm, 1))
  geometry.setAttribute('aBright', new Float32BufferAttribute(bright, 1))

  const inter = cream.clone().lerp(blue, 0.25).multiplyScalar(0.7)
  const material = ctx.keep(
    new ShaderMaterial({
      vertexShader: orbitVertex,
      fragmentShader: POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: ctx.time,
        uScale: ctx.pointScale,
        uInter: { value: inter },
        uFalloff: { value: 6 },
      },
    }),
  )
  const stars = new Points(geometry, material)
  stars.frustumCulled = false
  spin.add(stars)

  // --- Núcleo: brillo denso y amarillento ---
  const core = emptyCloud()
  pushPoint(core, 0, 0, 0, warm.clone().multiplyScalar(0.32), 1.05)
  pushPoint(core, 0, 0, 0, warm.clone().lerp(white, 0.3).multiplyScalar(0.5), 0.3)
  const glow = makePoints(ctx, core, { falloff: 5 })
  spin.add(glow)

  // --- Polvo: en el borde interior (cóncavo) de cada brazo, fijo al patrón ---
  const dust = emptyCloud()
  for (let i = 0; i < DUST; i += 1) {
    const a = 0.16 + Math.pow(random(), 0.8) * 0.72
    const side = random() < 0.5 ? 0 : Math.PI
    const r = a * (0.885 + gauss(random) * 0.02)
    const angle = armAngle(a) + side + gauss(random) * 0.04
    // Casi negro: el polvo absorbe la luz de las estrellas, no brilla.
    tint.copy(dustColor).multiplyScalar(0.05 + random() * 0.06)
    pushPoint(dust, Math.cos(angle) * r, gauss(random) * 0.008, Math.sin(angle) * r, tint, 0.04 + random() * 0.04)
  }
  const lanes = makePoints(ctx, dust, { blending: NormalBlending, falloff: 3, opacity: 0.18 })
  lanes.renderOrder = 2
  spin.add(lanes)

  // Satélites: M32 (compacta, junto al núcleo) y M110 (alargada y difusa), como en la foto.
  const companions = emptyCloud()
  const satellite = (x: number, y: number, count: number, sx: number, sy: number, roll: number, brightness: number) => {
    const c = Math.cos(roll)
    const s = Math.sin(roll)
    for (let i = 0; i < count; i += 1) {
      const u = gauss(random) * sx
      const v = gauss(random) * sy
      tint.copy(cream).lerp(warm, random() * 0.5)
      pushPoint(companions, x + u * c - v * s, y + u * s + v * c, 0.2, tint.multiplyScalar(0.5), 0.01 + random() * 0.01)
    }
    pushPoint(companions, x, y, 0.2, warm.clone().lerp(white, 0.3).multiplyScalar(brightness), Math.max(sx, sy) * 5)
  }
  satellite(0.03, -0.32, 160, 0.018, 0.015, 0, 0.7)
  satellite(0.3, 0.33, 260, 0.07, 0.035, -0.9, 0.35)
  const dwarfs = makePoints(ctx, companions, { falloff: 6, opacity: 0.75 })
  root.add(dwarfs)

  return {
    object: root,
    cameraZ: 3.55,
    stillTime: 0,
    update(t) {
      spin.rotation.y = t * PATTERN_SPEED
    },
  }
}
