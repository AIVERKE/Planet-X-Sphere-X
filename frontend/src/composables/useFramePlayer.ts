import { onUnmounted, ref, watch, type Ref } from 'vue'

/**
 * Play/pausa, paso a paso y slider para una secuencia de cuadros.
 * Lo usan el reproductor SPHEREx y el blink unWISE / PanSTARRS.
 */
export function useFramePlayer(count: Ref<number>) {
  const index = ref(0)
  const playing = ref(false)
  const msPerFrame = ref(700)
  let timer: ReturnType<typeof setInterval> | null = null

  function intervalMs(): number {
    const ms = Number(msPerFrame.value)
    if (!Number.isFinite(ms)) return 700
    return Math.min(4000, Math.max(200, ms))
  }

  function stop() {
    playing.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function play() {
    if (count.value < 2) return
    stop()
    playing.value = true
    timer = setInterval(() => {
      index.value = (index.value + 1) % Math.max(count.value, 1)
    }, intervalMs())
  }

  function toggle() {
    if (playing.value) stop()
    else play()
  }

  function select(next: number) {
    const total = count.value
    if (total <= 0) {
      index.value = 0
      return
    }
    index.value = ((next % total) + total) % total
    if (playing.value) play()
  }

  function next() {
    select(index.value + 1)
  }

  function prev() {
    select(index.value - 1)
  }

  function reset() {
    stop()
    index.value = 0
  }

  watch(msPerFrame, () => {
    if (playing.value) play()
  })

  watch(count, (total) => {
    if (index.value >= total) index.value = 0
    if (total < 2) stop()
  })

  onUnmounted(stop)

  return { index, playing, msPerFrame, play, stop, toggle, select, next, prev, reset }
}
