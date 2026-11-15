<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  { compact: false },
)

const { m, toggleLocale } = useI18n()
</script>

<template>
  <button
    type="button"
    class="lang-toggle hud-link hud-underline pointer-events-auto pb-1 text-[11px] tracking-[0.24em] uppercase"
    :aria-label="m.lang.aria"
    :title="m.lang.aria"
    @click="toggleLocale"
  >
    <span class="hud-text-muted">{{ m.lang.current }}</span>
    <span aria-hidden="true"> · </span>
    <span>{{ compact ? m.lang.switchToShort : m.lang.switchTo }}</span>
  </button>
</template>
