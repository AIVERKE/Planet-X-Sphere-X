<script setup lang="ts">
import { computed } from 'vue'
import { chapters } from '@/data/chapters'
import { useSpaceStore } from '@/stores/useSpaceStore'
import { fadeWindow } from '@/utils/fadeWindow'

const store = useSpaceStore()

const lookOpacity = computed(() => (store.cameraMode === 'look' && store.skyReady ? 1 : 0))
const chapter = computed(() => chapters.find((item) => item.phase === store.phase) ?? chapters[0])
const copyOpacity = computed(() => {
  if (store.cameraMode === 'look' || store.phase >= 4) return 0
  return fadeWindow(store.scrollProgress, chapter.value.copyStart, chapter.value.copyEnd)
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-[36%] z-10 flex justify-center px-[7vw] transition-opacity duration-500"
    :style="{ opacity: lookOpacity }"
  >
    <h1 class="hud-text text-center text-[clamp(18px,3.2vw,42px)] font-medium tracking-[0.22em] uppercase">
      Planet X and SPHEREx
    </h1>
  </div>

  <div class="pointer-events-none fixed inset-0 z-10" :style="{ opacity: copyOpacity }">
    <h2
      class="hud-text absolute top-[18%] left-[7vw] max-w-[16ch] text-[clamp(26px,4vw,58px)] leading-[1.05] font-medium tracking-[0.14em] uppercase"
    >
      {{ chapter.title }}
    </h2>
    <p class="hud-text-muted absolute top-[46%] right-[7vw] max-w-[280px] text-[13px] leading-relaxed">
      {{ chapter.body }}
    </p>
  </div>
</template>
