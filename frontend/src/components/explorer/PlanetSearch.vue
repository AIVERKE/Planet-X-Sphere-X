<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'
import { useSpaceStore } from '@/stores/useSpaceStore'

const store = useSpaceStore()
const { m } = useI18n()
</script>

<template>
  <label class="block">
    <span class="hud-text-muted mb-2 block text-[10px] tracking-[0.28em] uppercase">
      {{ m.search.label }}
    </span>
    <input
      v-model="store.query"
      type="search"
      :placeholder="m.search.placeholder"
      class="hud-text w-full border-0 border-b border-white/35 bg-transparent px-0 py-3 text-sm outline-none placeholder:text-white/70"
      autocomplete="off"
    />
  </label>
</template>
