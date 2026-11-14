<script setup lang="ts">
import { useSpaceStore } from '@/stores/useSpaceStore'
import type { PlanetFilter } from '@/types/explorer'

const store = useSpaceStore()

const filters: { id: PlanetFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'estrella', label: 'Estrella' },
  { id: 'rocosos', label: 'Rocosos' },
  { id: 'gaseosos', label: 'Gigantes gaseosos' },
  { id: 'satelite', label: 'Satélite' },
  { id: 'habitables', label: 'Exoplanetas habitables' },
]
</script>

<template>
  <div class="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="Filtrar planetas">
    <button
      v-for="item in filters"
      :key="item.id"
      type="button"
      class="hud-link hud-underline pb-1 text-[10px] tracking-[0.16em] uppercase"
      :class="{ 'is-active': store.filter === item.id }"
      :aria-pressed="store.filter === item.id"
      @click="store.filter = item.id"
    >
      {{ item.label }}
    </button>
  </div>
</template>
