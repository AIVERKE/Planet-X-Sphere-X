<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { NOISE_GLSL } from '@/three/materials/noise.glsl'
import type { CatalogShape } from '@/data/skyCatalog'

const props = defineProps<{
  shape: CatalogShape
  colors: [string, string, string]
}>()

const host = ref<HTMLElement | null>(null)
const camLocal = new Vector3()
const inverseWorld = new Matrix4()

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let root: Group | null = null
let volume: Mesh | null = null
let frame = 0
let disposed = false
const trash: { dispose: () => void }[] = []

const volumeVertex = /* glsl */ `
varying vec3 vObj;
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const volumeFragment = /* glsl */ `
${NOISE_GLSL}
varying vec3 vObj;
uniform vec3 uCam;
uniform float uKind;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.05 + 0.2;
    a *= 0.5;
  }
  return v;
}

float nebula(vec3 p) {
  vec3 q = p * 1.7;
  q.x += fbm3(p * 1.15) * 0.95;
  q.y += fbm3(p * 1.15 + 6.0) * 0.95;
  q.z += fbm3(p * 1.15 + 12.0) * 0.55;
  float filaments = pow(ridged(q * 1.55), 1.35);
  float body = smoothstep(0.12, 0.7, fbm3(p * 1.45 + 2.0));
  float mask = smoothstep(0.98, 0.12, length(p));
  return filaments * (0.45 + body) * mask * 2.1;
}

float shell(vec3 p) {
  float ring = exp(-pow(length(p.xz) - 0.5, 2.0) * 18.0) * exp(-pow(p.y * 1.8, 2.0) * 2.8);
  float knots = 0.55 + 0.45 * ridged(p * 2.6);
  float core = exp(-dot(p, p) * 26.0);
  return (ring * knots * 2.4 + core * 1.3) * smoothstep(1.0, 0.12, length(p));
}

float galaxy(vec3 p) {
  float rad = length(p.xz);
  float disk = exp(-abs(p.y) * 3.6) * exp(-rad * rad * 0.42);
  float arm = pow(0.5 + 0.5 * sin(atan(p.z, p.x) * 2.0 - rad * 8.5), 1.6);
  float lanes = smoothstep(0.15, 0.8, fbm3(vec3(p.xz * 2.4, p.y)));
  float bulge = exp(-dot(p, p) * 7.0);
  return disk * (0.2 + arm * lanes) * 1.6 + bulge * 0.85;
}

void main() {
  vec3 ro = uCam;
  vec3 rd = normalize(vObj - ro);
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.0;
  float disc = b * b - c;
  if (disc < 0.0) discard;
  float s = sqrt(disc);
  float t0 = max(-b - s, 0.0);
  float t1 = -b + s;
  const int STEPS = 28;
  float dt = (t1 - t0) / float(STEPS);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (t0 + dt * (float(i) + 0.5));
    float d = uKind < 0.5 ? nebula(p) : (uKind < 1.5 ? shell(p) : galaxy(p));
    float heat = clamp(d, 0.0, 1.0);
    vec3 tint = mix(uC, uB, smoothstep(0.0, 0.35, heat));
    tint = mix(tint, uA, smoothstep(0.28, 0.85, heat));
    tint = mix(tint, vec3(1.0, 0.96, 0.9), smoothstep(0.72, 1.15, d));
    col += tint * d * dt * 5.2;
    alpha += d * dt * 1.7;
  }
  col = col / (1.0 + col * 0.45);
  alpha = clamp(alpha, 0.0, 0.92);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`

const jupiterVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vN = normalize(normalMatrix * normal);
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const jupiterFragment = /* glsl */ `
${NOISE_GLSL}
varying vec3 vN;
varying vec3 vP;
uniform vec3 uLight;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;

void main() {
  vec3 n = normalize(vN);
  vec3 p = normalize(vP);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  float warp = fbm(vec3(lon * 1.4, lat * 3.2, 0.4));
  float bands = 0.5 + 0.5 * sin(lat * 22.0 + warp * 1.6);
  float fine = 0.5 + 0.5 * sin(lat * 48.0 + lon * 3.0 + warp);
  vec3 cream = uC;
  vec3 ochre = uA;
  vec3 rust = uB;
  vec3 col = mix(cream, ochre, bands);
  col = mix(col, rust, smoothstep(0.62, 1.0, fine) * 0.55);
  vec2 spot = vec2((lon - 0.6) * 1.35, (lat + 0.22) * 2.3);
  float oval = exp(-dot(spot, spot) * 7.0);
  col = mix(col, vec3(0.62, 0.24, 0.16), oval);
  float ndl = clamp(dot(n, normalize(uLight)), 0.0, 1.0);
  float rim = pow(1.0 - abs(n.z), 2.4);
  col *= 0.22 + 0.78 * ndl;
  col += cream * rim * 0.12;
  gl_FragColor = vec4(col, 1.0);
}
`

function keep<T extends { dispose: () => void }>(item: T) {
  trash.push(item)
  return item
}

function kindValue(shape: CatalogShape) {
  if (shape === 'nebula') return 0
  if (shape === 'ring') return 1
  return 2
}

function makeVolume(shape: CatalogShape) {
  const material = keep(
    new ShaderMaterial({
      vertexShader: volumeVertex,
      fragmentShader: volumeFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uCam: { value: new Vector3(0, 0, 4) },
        uKind: { value: kindValue(shape) },
        uA: { value: new Color(props.colors[0]) },
        uB: { value: new Color(props.colors[1]) },
        uC: { value: new Color(props.colors[2]) },
      },
    }),
  )
  const mesh = new Mesh(keep(new SphereGeometry(1, 40, 28)), material)
  mesh.name = 'volume'
  return mesh
}

function makeJupiter() {
  const material = keep(
    new ShaderMaterial({
      vertexShader: jupiterVertex,
      fragmentShader: jupiterFragment,
      uniforms: {
        uLight: { value: new Vector3(0.4, 0.35, 1).normalize() },
        uA: { value: new Color(props.colors[0]) },
        uB: { value: new Color(props.colors[1]) },
        uC: { value: new Color(props.colors[2]) },
      },
    }),
  )
  return new Mesh(keep(new SphereGeometry(1, 64, 40)), material)
}

function makeCraft() {
  const group = new Group()
  const hull = new Mesh(
    keep(new SphereGeometry(0.34, 24, 16)),
    keep(new MeshStandardMaterial({ color: props.colors[0], metalness: 0.72, roughness: 0.28 })),
  )
  hull.scale.set(1.55, 0.62, 0.62)
  const panel = keep(
    new MeshStandardMaterial({
      color: props.colors[1],
      metalness: 0.45,
      roughness: 0.32,
      side: DoubleSide,
      emissive: props.colors[2],
      emissiveIntensity: 0.15,
    }),
  )
  const left = new Mesh(keep(new SphereGeometry(0.42, 12, 8)), panel)
  left.scale.set(0.18, 1.15, 0.55)
  left.position.x = -0.72
  const right = left.clone()
  right.position.x = 0.72
  group.add(hull, left, right)
  return group
}

function starTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  glow.addColorStop(0, 'rgba(255,250,240,1)')
  glow.addColorStop(0.35, 'rgba(255,244,220,0.7)')
  glow.addColorStop(1, 'rgba(255,244,220,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 32, 32)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return keep(texture)
}

function starfield() {
  const positions: number[] = []
  for (let i = 0; i < 220; i += 1) {
    const radius = 5.5 + Math.random() * 3
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta) * 0.72,
      radius * Math.cos(phi),
    )
  }
  const geometry = keep(new BufferGeometry())
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return new Points(
    geometry,
    keep(
      new PointsMaterial({
        color: '#fff6e4',
        map: starTexture() ?? undefined,
        size: 0.045,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    ),
  )
}

function buildRoot() {
  const group = new Group()
  if (props.shape === 'jupiter') {
    group.add(makeJupiter())
  } else if (props.shape === 'craft') {
    group.add(makeCraft())
  } else {
    volume = makeVolume(props.shape)
    group.add(volume)
  }
  return group
}

function resize() {
  if (!renderer || !camera || !host.value) return
  const width = Math.max(host.value.clientWidth, 1)
  const height = Math.max(host.value.clientHeight, 1)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}

function syncCamera() {
  if (!volume || !camera) return
  volume.updateWorldMatrix(true, false)
  inverseWorld.copy(volume.matrixWorld).invert()
  camLocal.copy(camera.position).applyMatrix4(inverseWorld)
  const material = volume.material as ShaderMaterial
  material.uniforms.uCam.value.copy(camLocal)
}

function tick() {
  if (disposed || !renderer || !scene || !camera) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (root && !reduce) root.rotation.y += props.shape === 'craft' ? 0.012 : 0.0045
  syncCamera()
  renderer.render(scene, camera)
  frame = requestAnimationFrame(tick)
}

function boot() {
  const node = host.value
  if (!node || renderer) return
  const canvas = document.createElement('canvas')
  node.appendChild(canvas)
  renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  scene = new Scene()
  camera = new PerspectiveCamera(30, 1, 0.1, 30)
  camera.position.set(0, 0.05, props.shape === 'jupiter' ? 3.35 : 3.7)
  scene.add(starfield())
  scene.add(new AmbientLight('#fff4e4', 0.45))
  const key = new DirectionalLight('#fff8ee', 2.2)
  key.position.set(2.4, 1.4, 3)
  scene.add(key)
  root = buildRoot()
  scene.add(root)
  resize()
  frame = requestAnimationFrame(tick)
}

function teardown() {
  disposed = true
  cancelAnimationFrame(frame)
  if (scene && root) scene.remove(root)
  for (const item of trash) item.dispose()
  trash.length = 0
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
  scene = null
  camera = null
  root = null
  volume = null
  host.value?.replaceChildren()
}

onMounted(() => {
  const node = host.value
  if (!node) return
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) boot()
  })
  observer.observe(node)
  onBeforeUnmount(() => observer.disconnect())
})

onBeforeUnmount(teardown)
</script>

<template>
  <div ref="host" class="orb" />
</template>

<style scoped>
.orb {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.orb :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
