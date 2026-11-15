<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import SpaceCanvas from '@/components/explorer/SpaceCanvas.vue'
import ScrollStage from '@/components/explorer/ScrollStage.vue'
import HudNav from '@/components/explorer/HudNav.vue'
import GuideLines from '@/components/explorer/GuideLines.vue'
import ChapterMarker from '@/components/explorer/ChapterMarker.vue'
import EditorialCopy from '@/components/explorer/EditorialCopy.vue'
import PlanetExplorerHUD from '@/components/explorer/PlanetExplorerHUD.vue'
import SpherexMissionSection from '@/components/explorer/SpherexMissionSection.vue'
import { useI18n } from '@/composables/useI18n'
import { useSpaceStore } from '@/stores/useSpaceStore'
import '@/styles/explorer.css'

const store = useSpaceStore()
const { m } = useI18n()

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('is-explorer')
}

const hint = computed(() => {
  if (store.cameraMode !== 'look') return ''
  if (!store.skyReady) return m.value.look.loading
  if (store.lookingAtSky) return m.value.look.lookingSky
  return m.value.look.dragHint
})

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && store.cameraMode !== 'scroll' && store.cameraMode !== 'look') {
    store.requestRail(null)
  }
  if ((event.key === 'Enter' || event.key === ' ') && store.cameraMode === 'look') {
    event.preventDefault()
    store.requestAscent()
  }
}

onMounted(() => {
  window.scrollTo(0, 0)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.classList.remove('is-explorer')
  document.documentElement.classList.remove('is-look-locked')
  store.reset()
})
</script>

<template>
  <div class="explorer-root text-white">
    <SpaceCanvas />
    <div class="pointer-events-none fixed inset-0 z-10">
      <div class="explorer-vignette" />
      <HudNav />
      <GuideLines />
      <ChapterMarker />
      <EditorialCopy />
      <PlanetExplorerHUD />
      <SpherexMissionSection />

      <div
        v-if="store.cameraMode === 'look'"
        class="fixed inset-x-0 bottom-10 flex flex-col items-center gap-4 px-6 text-center"
      >
        <div class="h-px w-40 bg-white/25">
          <div
            class="h-px bg-white transition-[width] duration-100"
            :style="{ width: `${store.skyGaze * 100}%` }"
          />
        </div>
        <p class="hud-text text-[11px] tracking-[0.28em] uppercase">{{ hint }}</p>
        <button
          type="button"
          class="hud-link hud-underline pointer-events-auto pb-1 text-[10px] tracking-[0.22em] uppercase"
          @click="store.requestAscent()"
        >
          {{ m.look.ascend }}
        </button>
      </div>

      <div
        v-show="store.cameraMode === 'scroll' && store.scrollProgress < 0.48 && store.scrollProgress > 0.4"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 text-center"
      >
        <div class="scroll-line mx-auto mb-3 h-12 w-px bg-white/60" />
        <p class="hud-text-muted text-[11px] tracking-[0.32em] uppercase">
          {{ m.scroll.continue }}
        </p>
      </div>

      <div
        v-show="store.hasAscended"
        class="fixed right-6 bottom-8 hidden h-28 w-px bg-white/20 md:block"
        aria-hidden="true"
      >
        <div class="w-px bg-white" :style="{ height: `${store.scrollProgress * 100}%` }" />
      </div>
    </div>
    <ScrollStage v-show="store.hasAscended" />
  </div>
</template>
