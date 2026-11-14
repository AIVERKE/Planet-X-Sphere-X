<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { WorldMarkerData } from '@/types/explorer'
import { bindProjectedElement, unbindProjectedElement } from '@/composables/useProjectedMarkers'
import { useSpaceStore } from '@/stores/useSpaceStore'

const props = defineProps<{ marker: WorldMarkerData }>()
const root = ref<HTMLElement | null>(null)
const store = useSpaceStore()

onMounted(() => {
  if (!root.value) return
  bindProjectedElement(props.marker.id, root.value, () => store.phase === 2)
})

onBeforeUnmount(() => {
  unbindProjectedElement(props.marker.id)
})
</script>

<template>
  <div ref="root" class="pointer-events-none absolute top-0 left-0 z-20 opacity-0">
    <div class="flex items-center gap-3 whitespace-nowrap">
      <span class="block h-2.5 w-2.5 rotate-45 border border-white" />
      <span class="hud-text text-[11px] tracking-[0.22em] uppercase">{{ marker.index }} {{ marker.name }}</span>
    </div>
  </div>
</template>
