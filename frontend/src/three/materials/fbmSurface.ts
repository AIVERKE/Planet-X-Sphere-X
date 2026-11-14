import { Color, ShaderMaterial, Vector3 } from 'three'
import { NOISE_GLSL } from './noise.glsl'

const terrainVertex = /* glsl */ `
uniform float uDisplace;
uniform float uSeed;
varying vec3 vWorld;
varying float vElev;
${NOISE_GLSL}

void main() {
  vec3 p = position;
  float ridge = ridged(vec3(p.xy * 0.055, uSeed));
  float peaks =
    exp(-dot(p.xy, p.xy) * 0.0042) * 1.2 +
    exp(-dot(p.xy - vec2(8.0, 1.6), p.xy - vec2(8.0, 1.6)) * 0.014) * 0.48 +
    exp(-dot(p.xy + vec2(9.0, -1.2), p.xy + vec2(9.0, -1.2)) * 0.012) * 0.4;
  float elev = pow(ridge, 1.25) * peaks * uDisplace;
  vElev = clamp(elev / max(uDisplace, 0.001), 0.0, 1.0);
  p.z += elev;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const terrainFragment = /* glsl */ `
varying vec3 vWorld;
varying float vElev;
uniform vec3 uFogColor;
uniform float uFogAmount;
uniform float uOpacity;
uniform vec3 uLightDir;

void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  float ndl = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);
  vec3 valley = vec3(0.035, 0.055, 0.09);
  vec3 rock = vec3(0.23, 0.18, 0.16);
  vec3 snow = vec3(0.82, 0.78, 0.74);
  vec3 col = mix(valley, rock, smoothstep(0.08, 0.38, vElev));
  col = mix(col, snow, smoothstep(0.58, 0.88, vElev));
  col *= 0.16 + ndl * 0.95;
  col += vec3(0.85, 0.38, 0.16) * pow(ndl, 2.4) * smoothstep(0.45, 0.9, vElev);
  float dist = length(vWorld.xz - cameraPosition.xz);
  float fog = smoothstep(10.0, 34.0, dist) * uFogAmount;
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, uOpacity);
}
`

const planetVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vLocal;

void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const planetFragment = /* glsl */ `
varying vec3 vNormal;
varying vec3 vLocal;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uLightDir;
uniform float uTime;
uniform float uSeed;
uniform float uKind;
uniform float uBands;
${NOISE_GLSL}

void main() {
  vec3 sp = normalize(vLocal);
  float n = fbm(vLocal * 0.55 + uSeed);
  float fine = fbm(vLocal * 1.7 + uSeed * 2.0);
  vec3 col;

  if (uKind < 0.5) {
    float land = smoothstep(0.5, 0.6, n);
    float ice = smoothstep(0.72, 0.95, abs(sp.y));
    col = mix(uColorA, uColorB, land);
    col = mix(col, uColorC, ice * (1.0 - land * 0.35));
    col += vec3(0.05, 0.08, 0.04) * fine * land;
  } else if (uKind < 1.5) {
    col = mix(uColorA, uColorB, n);
    float cap = smoothstep(0.78, 0.96, abs(sp.y));
    col = mix(col, uColorC, cap);
    float dune = smoothstep(0.55, 0.8, fine);
    col = mix(col, uColorB, dune * 0.35);
  } else if (uBands > 0.5) {
    float bands = sin(sp.y * 26.0 + fbm(vLocal * 0.8 + uTime * 0.03) * 2.4);
    col = mix(uColorA, uColorB, bands * 0.5 + 0.5);
    float spot = smoothstep(0.68, 0.9, fbm(vLocal * 0.9 + 3.0));
    col = mix(col, uColorC, spot * 0.55);
  } else {
    col = mix(uColorA, uColorB, n);
    col = mix(col, uColorC, smoothstep(0.62, 0.86, fine));
  }

  float ndl = clamp(dot(normalize(vNormal), normalize(uLightDir)), 0.0, 1.0);
  col *= 0.18 + ndl * 0.95;
  gl_FragColor = vec4(col, 1.0);
}
`

export function createTerrainMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uDisplace: { value: 7.2 },
      uSeed: { value: 2.2 },
      uFogColor: { value: new Color('#d9d0c0') },
      uFogAmount: { value: 0 },
      uOpacity: { value: 1 },
      uLightDir: { value: new Vector3(0.85, 0.28, 0.35).normalize() },
    },
    vertexShader: terrainVertex,
    fragmentShader: terrainFragment,
    transparent: true,
    toneMapped: false,
  })
}

export function createPlanetMaterial(options: {
  colors: { a: string; b: string; c: string }
  seed: number
  kind: number
  bands: boolean
}) {
  return new ShaderMaterial({
    uniforms: {
      uColorA: { value: new Color(options.colors.a) },
      uColorB: { value: new Color(options.colors.b) },
      uColorC: { value: new Color(options.colors.c) },
      uLightDir: { value: new Vector3(0.45, 0.55, 0.7).normalize() },
      uTime: { value: 0 },
      uSeed: { value: options.seed },
      uKind: { value: options.kind },
      uBands: { value: options.bands ? 1 : 0 },
    },
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
    toneMapped: false,
  })
}

export function planetKind(id: string, bands: boolean) {
  if (id === 'earth') return 0
  if (id === 'mars') return 1
  if (bands) return 2
  return 3
}
