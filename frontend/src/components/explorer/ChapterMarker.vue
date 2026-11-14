<script setup lang="ts">
import { computed } from 'vue'
import { chapters } from '@/data/chapters'
import { useSpaceStore } from '@/stores/useSpaceStore'

const store = useSpaceStore()

const chapter = computed(() => chapters.find((item) => item.phase === store.phase) ?? chapters[0])

const opacity = computed(() => {
  if (store.cameraMode === 'look') return 0.9
  if (store.phase >= 5) return 0
  if (store.phase < 4) return 1
  return Math.max(0.35, 1 - (store.scrollProgress - 0.72) / 0.2)
})
</script>

<template>
  <div
    class="pointer-events-none fixed top-1/2 left-6 z-20 flex -translate-y-1/2 items-center gap-4 md:left-10"
    :style="{ opacity }"
  >
    <span class="block h-2.5 w-2.5 rotate-45 border border-white/70" />
    <div>
      <p class="hud-text-muted text-[10px] tracking-[0.32em]">{{ chapter.index }}</p>
      <p class="hud-text text-[12px] tracking-[0.22em] uppercase">{{ chapter.name }}</p>
    </div>
  </div>
</template>
