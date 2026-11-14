import { type Ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSpaceStore } from '@/stores/useSpaceStore'

gsap.registerPlugin(ScrollTrigger)

export function scrollToProgress(progress: number) {
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo({ top: Math.max(0, max) * progress, behavior: 'smooth' })
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
