import { AdditiveBlending, Color, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { buildStarfield, emptyCloud, gauss, makePoints, pushPoint, seeded } from './points'
import type { ShapeBuilder } from './types'

/**
 * Nebulosa de emisión (referencia: M42, Orión).
 * Señales: filamentos, huecos oscuros que atraviesan la nube y estrellas embebidas.
 * Capas de planos con fBm + domain warp; contorno irregular, nunca esférico.
 */

const LAYERS = 5
const WIDTH = 2.7
const HEIGHT = 2.1

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Ruido de valor 2D (4 hashes por muestra, la mitad que el 3D): la nebulosa es la forma más cara.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uGain;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    v += a * noise2(p);
    p = ROT * p + 0.31;
    a *= 0.5;
  }
  return v;
}

float fbm4(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = ROT * p + 0.17;
    a *= 0.5;
  }
  return v;
}

float ridged4(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * (1.0 - abs(noise2(p) * 2.0 - 1.0));
    p = ROT * p + 0.11;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(${WIDTH.toFixed(2)}, ${HEIGHT.toFixed(2)});
  vec2 seed = vec2(uSeed * 7.13, uSeed * 3.71);

  // Contorno irregular: un óvalo deformado por ruido, con viñeta de seguridad en el borde del plano.
  float outline = length(p * vec2(0.66, 0.9)) + (fbm3(p * 1.25 + seed * 0.1 + 4.0) - 0.45) * 1.05;
  vec2 edge = abs(vUv - 0.5);
  float frame = smoothstep(0.5, 0.36, edge.x) * smoothstep(0.5, 0.34, edge.y);
  float mask = smoothstep(1.02, 0.22, outline) * frame;
  if (mask < 0.004) discard;

  vec2 drift = vec2(uTime * 0.018, uTime * -0.011);

  // Domain warp: el gas se pliega en filamentos.
  vec2 q = p * 1.25 + seed + drift;
  vec2 warp = vec2(fbm3(q), fbm3(q + vec2(5.2, 1.3)));
  vec2 r = p * 1.7 + warp * 1.5 + seed * 0.37 + drift * 0.6;
  float body = smoothstep(0.22, 0.85, fbm4(r));
  float filaments = pow(ridged4(r * 1.8 + 3.1), 3.0);

  // Huecos de polvo: misma semilla en todas las capas para que el hueco atraviese la nube.
  vec2 dp = p + vec2(sin(uTime * 0.036) * 0.03, 0.0);
  float dust = smoothstep(0.5, 0.64, fbm3(dp * 1.9 + 11.0));
  float lane = smoothstep(0.12, 0.0, abs(dp.y + 0.18 + 0.32 * sin(dp.x * 2.1 + 0.6)) - 0.05) * smoothstep(0.9, 0.2, abs(dp.x + 0.15));

  // Región brillante desplazada (cúmulo del Trapecio).
  vec2 c = p - vec2(-0.14, 0.12);
  float core = exp(-dot(c, c) * 3.4);

  float d = (body * 0.2 + filaments * 1.7 + core * 0.15) * mask;
  d *= 1.0 - 0.95 * max(dust, lane * 0.9);

  float heat = clamp(d * 0.75 + core * 0.35, 0.0, 1.0);
  // Domina el rosa del hidrógeno (uB); el púrpura queda en lo más tenue y el tono cálido, en el núcleo.
  vec3 col = mix(uC, uB, smoothstep(0.0, 0.22, heat));
  col = mix(col, uA, smoothstep(0.5, 0.95, heat) * (0.3 + 0.7 * core));
  col = mix(col, vec3(1.0, 0.95, 0.9), smoothstep(0.9, 1.0, heat) * core);

  // Compresión suave por capa: el núcleo brilla en oro sin quemarse en blanco al sumar
  // las capas, y los filamentos conservan su contraste.
  float alpha = 0.3 * (1.0 - exp(-d * uGain * 4.0));
  gl_FragColor = vec4(col * (0.8 + 0.4 * heat), alpha);
  #include <colorspace_fragment>
}
`

export const buildNebula: ShapeBuilder = (ctx) => {
  const random = seeded(42)
  const root = new Group()
  root.name = 'nebula'
  root.add(buildStarfield(ctx))

  const cloud = new Group()
  root.add(cloud)

  const plane = ctx.keep(new PlaneGeometry(WIDTH, HEIGHT, 1, 1))
  const [colorA, colorB, colorC] = ctx.colors
  for (let i = 0; i < LAYERS; i += 1) {
    const depth = -0.45 + (0.9 * i) / (LAYERS - 1)
    const material = ctx.keep(
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: ctx.time,
          uSeed: { value: 1.7 + i * 2.31 },
          uGain: { value: 0.42 - Math.abs(depth) * 0.2 },
          uA: { value: colorA },
          uB: { value: colorB },
          uC: { value: colorC },
        },
      }),
    )
    const layer = new Mesh(plane, material)
    layer.position.z = depth
    layer.rotation.z = (random() - 0.5) * 0.5
    const stretch = 0.92 + random() * 0.16
    layer.scale.set(stretch, 2 - stretch, 1)
    layer.renderOrder = i
    cloud.add(layer)
  }

  // Estrellas embebidas en el volumen de la nube.
  const stars = emptyCloud()
  const white = new Color('#fff6ea')
  const blue = new Color('#cfe0ff')
  const tint = new Color()
  for (let i = 0; i < 90; i += 1) {
    const x = gauss(random) * 0.48
    const y = gauss(random) * 0.36
    const z = (random() - 0.5) * 0.9
    tint.copy(white).lerp(blue, random()).multiplyScalar(0.55 + random() * 0.45)
    pushPoint(stars, x, y, z, tint, 0.018 + random() * random() * 0.05)
  }
  // Trapecio: cuatro estrellas jóvenes, azul-blancas, en la región brillante.
  const trapezium: [number, number][] = [
    [-0.18, 0.15],
    [-0.11, 0.17],
    [-0.15, 0.09],
    [-0.09, 0.11],
  ]
  for (const [x, y] of trapezium) {
    pushPoint(stars, x, y, 0.05, blue, 0.085 + random() * 0.03)
  }
  const embedded = makePoints(ctx, stars, { falloff: 9 })
  embedded.renderOrder = LAYERS + 1
  cloud.add(embedded)

  return {
    object: root,
    cameraZ: 3.7,
    // Forma difusa: a DPR 1 no pierde nitidez visible y cuesta 2.25× menos píxeles que a 1.5.
    pixelRatio: 1,
    stillTime: 0,
    update(t) {
      cloud.rotation.y = Math.sin(t * 0.12) * 0.22
      cloud.rotation.x = Math.sin(t * 0.09 + 1.3) * 0.08
    },
  }
}
