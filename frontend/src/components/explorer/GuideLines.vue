<script setup lang="ts">
import { computed } from 'vue'
import { useSpaceStore } from '@/stores/useSpaceStore'
import { fadeWindow } from '@/utils/fadeWindow'

const store = useSpaceStore()
const lines = [18, 40, 62, 84]

const opacity = computed(() => {
  if (store.cameraMode === 'look') return 0.35
  return fadeWindow(store.scrollProgress, 0.35, 0.5, 0.05)
})
</script>

<template>
  <div class="pointer-events-none fixed inset-0" :style="{ opacity }" aria-hidden="true">
    <span
      v-for="(left, index) in lines"
      :key="left"
      class="absolute top-0 h-full w-px bg-white/20"
      :style="{
        left: `${left}%`,
        transform: `translateX(${(index % 2 === 0 ? -1 : 1) * store.scrollProgress * 42}px)`,
      }"
    />
  </div>
</template>
