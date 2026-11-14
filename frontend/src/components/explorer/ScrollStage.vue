<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useScrollProgress } from '@/composables/useScrollProgress'
import { useSpaceStore } from '@/stores/useSpaceStore'

const stage = ref<HTMLElement | null>(null)
const scroll = useScrollProgress(stage)
const store = useSpaceStore()

onMounted(() => {
  if (store.hasAscended) scroll.mount()
})

watch(
  () => store.hasAscended,
  (ascended) => {
    if (ascended) {
      requestAnimationFrame(() => scroll.mount())
    } else {
      scroll.destroy()
    }
  },
)

onUnmounted(() => scroll.destroy())
</script>

<template>
  <div
    ref="stage"
    class="relative"
    :class="store.hasAscended ? 'h-[640vh]' : 'h-screen'"
  />
</template>
