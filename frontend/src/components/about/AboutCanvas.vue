<script setup lang="ts">
import { markRaw, onMounted, onUnmounted, ref, watch } from 'vue'
import { Clock, PerspectiveCamera, type WebGLRenderer } from 'three'
import { useI18n } from '@/composables/useI18n'
import { createRenderer, idealPixelRatio } from '@/three/createRenderer'
import { createAboutRig } from '@/three/about/createAboutRig'

const props = defineProps<{
  progress: number
}>()

const { m } = useI18n()

const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const ready = ref(false)

let frameId = 0
let resizeObserver: ResizeObserver | null = null
let renderer: WebGLRenderer | null = null
let rig: ReturnType<typeof createAboutRig> | null = null
let view: PerspectiveCamera | null = null

onMounted(async () => {
  if (!canvas.value) return
  try {
    renderer = createRenderer(canvas.value)
    rig = markRaw(createAboutRig())
    view = markRaw(new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.08, 400))
    rig.applyScroll(view, props.progress)

    const clock = new Clock()
    const resize = () => {
      if (!renderer || !view) return
      const width = window.innerWidth
      const height = window.innerHeight
      view.aspect = width / Math.max(height, 1)
      view.updateProjectionMatrix()
      renderer.setPixelRatio(idealPixelRatio())
      renderer.setSize(width, height, false)
    }
    resize()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(document.documentElement)

    await rig.load()
    ready.value = true

    const loop = () => {
      if (!renderer || !rig || !view) return
      rig.applyScroll(view, props.progress)
      rig.update(clock.getElapsedTime(), props.progress, view)
      renderer.render(rig.scene, view)
      frameId = requestAnimationFrame(loop)
    }
    loop()
  } catch {
    failed.value = true
  }
})

watch(
  () => props.progress,
  (value) => {
    if (rig && view) rig.applyScroll(view, value)
  },
)

onUnmounted(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  rig?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <canvas
    ref="canvas"
    class="fixed inset-0 z-0 block h-full w-full"
    aria-hidden="true"
  />
  <p
    v-if="failed"
    class="hud-text fixed inset-0 z-20 grid place-items-center px-8 text-center text-sm tracking-[0.18em] uppercase"
  >
    {{ m.about.error }}
  </p>
  <p
    v-else-if="!ready"
    class="hud-text pointer-events-none fixed inset-0 z-20 grid place-items-center text-[11px] tracking-[0.28em] uppercase"
  >
    {{ m.about.loading }}
  </p>
</template>
