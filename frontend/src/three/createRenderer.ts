import { ACESFilmicToneMapping, SRGBColorSpace, WebGLRenderer } from 'three'
import { markRaw } from 'vue'

export function idealPixelRatio() {
  const dpr = window.devicePixelRatio || 1
  const cores = navigator.hardwareConcurrency || 4
  const cap = cores <= 4 ? 1 : 1.25
  return Math.min(dpr, cap)
}

export function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(idealPixelRatio())
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.setClearColor(0x03050a, 1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  return markRaw(renderer)
}
