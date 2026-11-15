<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useLocalizedContent } from '@/composables/useLocalizedContent'
import { useSpaceStore } from '@/stores/useSpaceStore'
import { fadeWindow } from '@/utils/fadeWindow'

const store = useSpaceStore()
const { m } = useI18n()
const { chapters } = useLocalizedContent()

const lookOpacity = computed(() => (store.cameraMode === 'look' && store.skyReady ? 1 : 0))
const chapter = computed(() => chapters.value.find((item) => item.phase === store.phase) ?? chapters.value[0])
const copyOpacity = computed(() => {
  if (store.cameraMode === 'look' || store.phase >= 4) return 0
  return fadeWindow(store.scrollProgress, chapter.value.copyStart, chapter.value.copyEnd)
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-[36%] z-10 flex flex-col items-center gap-4 px-[7vw] transition-opacity duration-500"
    :style="{ opacity: lookOpacity }"
  >
    <span class="hud-diamond block h-2 w-2 rotate-45 border" aria-hidden="true" />
    <h1 class="hud-text-gold text-center text-[clamp(28px,6.5vw,72px)] font-bold tracking-[0.14em] uppercase">
      {{ m.brand }}
    </h1>
  </div>

  <div class="pointer-events-none fixed inset-0 z-10" :style="{ opacity: copyOpacity }">
    <h2
      class="hud-text absolute top-[18%] left-[7vw] max-w-[16ch] text-[clamp(26px,4vw,58px)] leading-[1.05] font-medium tracking-[0.14em] uppercase"
    >
      <span class="hud-kicker-gold mb-3 block text-[10px] tracking-[0.36em]">
        {{ chapter.index }} · {{ chapter.name }}
      </span>
      {{ chapter.title }}
    </h2>
    <p
      class="hud-text-muted absolute top-[46%] right-[7vw] max-w-[280px] border-l border-[var(--hud-gold-border)] pl-4 text-[13px] leading-relaxed"
    >
      {{ chapter.body }}
    </p>
  </div>
</template>
