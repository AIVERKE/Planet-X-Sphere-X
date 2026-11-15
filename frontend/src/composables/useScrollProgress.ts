import { type Ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSpaceStore } from '@/stores/useSpaceStore'

gsap.registerPlugin(ScrollTrigger)

export function scrollToProgress(
  progress: number,
  behavior: ScrollBehavior = 'smooth',
) {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  window.scrollTo({ top: max * Math.min(1, Math.max(0, progress)), behavior })
  // Con scrub, forzar sync inmediata si el salto es instantáneo.
  if (behavior === 'auto') {
    ScrollTrigger.update()
  }
}

export function useScrollProgress(stage: Ref<HTMLElement | null>) {
  const store = useSpaceStore()
  let trigger: ScrollTrigger | null = null

  function mount() {
    if (!stage.value) return
    trigger = ScrollTrigger.create({
      trigger: stage.value,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.7,
      onUpdate: (self) => {
        // Solo el modo rail lee el scroll; durante travel/look no pisar el progress.
        if (store.cameraMode !== 'scroll') return
        store.scrollProgress = self.progress
      },
    })
  }

  function destroy() {
    trigger?.kill()
    trigger = null
  }

  return { mount, destroy }
}
