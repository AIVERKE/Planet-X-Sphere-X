<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Color, PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, WebGLRenderer } from 'three'
import { SHAPE_BUILDERS, type ShapeBuild, type ShapeContext } from '@/components/catalog/shapes'
import { useI18n } from '@/composables/useI18n'
import type { CatalogShape } from '@/data/skyCatalog'

const props = defineProps<{
  shape: CatalogShape
  colors: [string, string, string]
}>()

const { m } = useI18n()
const label = computed(() => m.value.catalog.orb[props.shape])

const host = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

/** DPR máximo: más no se nota en tarjetas pequeñas y cuesta GPU en móvil. */
const MAX_DPR = 1.5
/** Campo de visión mínimo (grados) en el eje más corto del canvas. */
const MIN_FOV = 30

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let build: ShapeBuild | null = null
let intersection: IntersectionObserver | null = null
let resizer: ResizeObserver | null = null
let frame = 0
let last = 0
let elapsed = 0
let running = false
let onScreen = false
let disposed = false
const trash: { dispose: () => void }[] = []
const time = { value: 0 }
const pointScale = { value: 1 }
const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

interface OrbDebug {
  shape: CatalogShape
  readonly renderer: WebGLRenderer | null
  readonly running: boolean
  /** Dibuja un cuadro (para medir el costo de render). */
  draw: () => void
}

/** Solo en desarrollo: window.__spxOrbs permite revisar contextos vivos y renderer.info. */
const debug: OrbDebug = {
  shape: props.shape,
  get renderer() {
    return renderer
  },
  get running() {
    return running
  },
  draw: () => draw(),
}

function registry() {
  const target = window as unknown as { __spxOrbs?: Set<OrbDebug> }
  target.__spxOrbs ??= new Set()
  return target.__spxOrbs
}

function keep<T extends { dispose: () => void }>(item: T) {
  // Una textura puede terminar de cargar después del teardown: se libera en el acto.
  if (disposed) {
    item.dispose()
    return item
  }
  trash.push(item)
  return item
}

function draw() {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function pose(t: number) {
  time.value = t
  build?.update(t)
}

function invalidate() {
  if (!disposed && !running) draw()
}

function loop(now: number) {
  if (!running) return
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  elapsed += dt
  pose(elapsed)
  draw()
  frame = requestAnimationFrame(loop)
}

function shouldRun() {
  return !!renderer && onScreen && !document.hidden && !motion.matches
}

/** Arranca o detiene el bucle según visibilidad, pestaña y prefers-reduced-motion. */
function sync() {
  if (disposed) return
  const want = shouldRun()
  if (want && !running) {
    running = true
    last = performance.now()
    frame = requestAnimationFrame(loop)
  } else if (!want && running) {
    running = false
    cancelAnimationFrame(frame)
  }
  if (!running && motion.matches && build) {
    // Movimiento reducido: un solo cuadro estático y representativo.
    elapsed = build.stillTime
    pose(elapsed)
    draw()
  }
}

function resize() {
  if (!renderer || !camera || !host.value) return
  const width = Math.max(host.value.clientWidth, 1)
  const height = Math.max(host.value.clientHeight, 1)
  const aspect = width / height
  const half = (MIN_FOV * Math.PI) / 360
  camera.aspect = aspect
  camera.fov = aspect >= 1 ? MIN_FOV : (2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
  pointScale.value = (height * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360))
}

function boot() {
  const node = canvas.value
  if (!node || !host.value || renderer || disposed) return
  try {
    renderer = new WebGLRenderer({ canvas: node, alpha: true, antialias: true, powerPreference: 'high-performance' })
  } catch {
    // Sin WebGL: el canvas queda vacío, pero conserva su aria-label.
    return
  }
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  scene = new Scene()
  camera = new PerspectiveCamera(MIN_FOV, 1, 0.1, 40)

  const loader = new TextureLoader()
  const ctx: ShapeContext = {
    keep,
    colors: [new Color(props.colors[0]), new Color(props.colors[1]), new Color(props.colors[2])],
    time,
    pointScale,
    loadTexture: (url, onLoad) => loader.load(url, onLoad),
    invalidate,
  }
  build = SHAPE_BUILDERS[props.shape](ctx)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, build.pixelRatio ?? MAX_DPR, MAX_DPR))
  camera.position.set(0, 0, build.cameraZ)
  scene.add(build.object)

  resize()
  resizer = new ResizeObserver(() => {
    resize()
    invalidate()
  })
  resizer.observe(host.value)

  elapsed = build.stillTime
  pose(elapsed)
  if (import.meta.env.DEV) registry().add(debug)
  sync()
  if (!running) draw()
}

function teardown() {
  disposed = true
  running = false
  cancelAnimationFrame(frame)
  intersection?.disconnect()
  resizer?.disconnect()
  document.removeEventListener('visibilitychange', sync)
  motion.removeEventListener('change', sync)
  if (scene && build) scene.remove(build.object)
  for (const item of trash) item.dispose()
  trash.length = 0
  renderer?.dispose()
  renderer?.forceContextLoss()
  if (import.meta.env.DEV) registry().delete(debug)
  renderer = null
  scene = null
  camera = null
  build = null
}

onMounted(() => {
  const node = host.value
  if (!node) return
  intersection = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1]?.isIntersecting ?? false
    if (onScreen) boot()
    sync()
  })
  intersection.observe(node)
  document.addEventListener('visibilitychange', sync)
  motion.addEventListener('change', sync)
})

onBeforeUnmount(teardown)
</script>

<template>
  <div ref="host" class="orb">
    <canvas ref="canvas" role="img" :aria-label="label" />
  </div>
</template>

<style scoped>
.orb {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.orb canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
