<script setup lang="ts">
import type { AtmosphereGas } from '@/types/explorer'

defineProps<{ gases: AtmosphereGas[] }>()
</script>

<template>
  <ul class="space-y-3">
    <li v-for="gas in gases" :key="gas.gas">
      <div class="mb-1 flex justify-between text-[11px] tracking-[0.12em] uppercase">
        <span class="hud-text-muted">{{ gas.gas }}</span>
        <span class="hud-text">{{ Math.round(gas.ratio * 100) }}%</span>
      </div>
      <div class="h-px bg-white/20">
        <div
          class="h-px bg-white/85 transition-all duration-700"
          :style="{ width: `${gas.ratio * 100}%` }"
        />
      </div>
    </li>
  </ul>
</template>
