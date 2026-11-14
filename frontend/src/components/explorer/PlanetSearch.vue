<script setup lang="ts">
import { useSpaceStore } from '@/stores/useSpaceStore'

const store = useSpaceStore()
</script>

<template>
  <label class="block">
    <span class="hud-text-muted mb-2 block text-[10px] tracking-[0.28em] uppercase">Buscador</span>
    <input
      v-model="store.query"
      type="search"
      placeholder="Nombre, tipo o atmósfera"
      class="hud-text w-full border-0 border-b border-white/25 bg-transparent px-0 py-3 text-sm outline-none placeholder:text-white/45"
      autocomplete="off"
    />
  </label>
</template>
