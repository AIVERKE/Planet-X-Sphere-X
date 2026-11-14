<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Hotspot } from '@/types/explorer'
import { bindProjectedElement, unbindProjectedElement } from '@/composables/useProjectedMarkers'
import { useSpaceStore } from '@/stores/useSpaceStore'

const props = defineProps<{
  planetId: string
  hotspot: Hotspot
}>()

const root = ref<HTMLElement | null>(null)
const store = useSpaceStore()

onMounted(() => {
  if (!root.value) return
  bindProjectedElement(props.hotspot.id, root.value, () => {
    return store.phase === 4 && store.activePlanetId === props.planetId
  })
})

onBeforeUnmount(() => {
  unbindProjectedElement(props.hotspot.id)
})
</script>

<template>
  <div ref="root" class="pointer-events-none absolute top-0 left-0 z-20 opacity-0">
    <div class="flex items-center gap-2 whitespace-nowrap">
      <span class="block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
      <span class="hud-text text-[10px] tracking-[0.18em] uppercase">
        {{ hotspot.label }}
      </span>
    </div>
  </div>
</template>
