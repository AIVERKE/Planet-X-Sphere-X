<script setup lang="ts">
import { markRaw, onMounted, onUnmounted, ref } from 'vue'
import { Clock, PerspectiveCamera, type WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createRenderer, idealPixelRatio } from '@/three/createRenderer'
import { createEarthToSpaceRig } from '@/three/EarthToSpaceRig'
import { useCameraRig } from '@/composables/useCameraRig'
import { updateProjected } from '@/composables/useProjectedMarkers'
import { useSpaceStore } from '@/stores/useSpaceStore'

const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const store = useSpaceStore()
const cameraRig = useCameraRig()

let frameId = 0
let resizeObserver: ResizeObserver | null = null
let renderer: WebGLRenderer | null = null
let rig: ReturnType<typeof createEarthToSpaceRig> | null = null

onMounted(async () => {
  if (!canvas.value) return
  try {
    document.documentElement.classList.add('is-look-locked')
    renderer = createRenderer(canvas.value)
    rig = markRaw(createEarthToSpaceRig())
    const view = markRaw(new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 400))
    const controls = markRaw(new OrbitControls(view, renderer.domElement))
    cameraRig.bind({ camera: view, controls, rig, canvas: canvas.value })

    const clock = new Clock()
    const resize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      view.aspect = width / Math.max(height, 1)
      view.updateProjectionMatrix()
      renderer?.setPixelRatio(idealPixelRatio())
      renderer?.setSize(width, height, false)
    }
    resize()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(document.documentElement)

    void rig.loadSky(renderer).then(() => {
      store.skyReady = true
    })

    const loop = () => {
      if (!renderer || !rig) return
      cameraRig.frame()
      rig.update(clock.getElapsedTime(), store.scrollProgress, renderer, view, store.cameraMode)
      if (store.cameraMode !== 'look') {
        updateProjected(view, window.innerWidth, window.innerHeight)
      }
      renderer.render(rig.scene, view)
      frameId = requestAnimationFrame(loop)
    }
    loop()
  } catch {
    failed.value = true
    document.documentElement.classList.remove('is-look-locked')
  }
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  cameraRig.dispose()
  rig?.dispose()
  renderer?.dispose()
  document.documentElement.classList.remove('is-look-locked')
})
</script>

<template>
  <canvas
    ref="canvas"
    class="fixed inset-0 z-0 block h-full w-full"
    :class="{ 'touch-none cursor-grab active:cursor-grabbing': store.cameraMode === 'look' || store.cameraMode === 'orbit' }"
    aria-label="Planet X and SPHEREx. Paisaje 360, luego exploración del sistema."
  />
  <p
    v-if="failed"
    class="hud-text fixed inset-0 z-20 grid place-items-center px-8 text-center text-sm tracking-[0.18em] uppercase"
  >
    Este recorrido necesita WebGL.
  </p>
  <p
    v-else-if="!store.skyReady && store.cameraMode === 'look'"
    class="hud-text pointer-events-none fixed inset-0 z-20 grid place-items-center text-[11px] tracking-[0.28em] uppercase"
  >
    Cargando paisaje…
  </p>
</template>
