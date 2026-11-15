<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { usePlanetSearch } from '@/composables/usePlanetSearch'
import { useSpaceStore } from '@/stores/useSpaceStore'
import PlanetSearch from '@/components/explorer/PlanetSearch.vue'
import TelemetryCard from '@/components/explorer/TelemetryCard.vue'

const store = useSpaceStore()
const { results } = usePlanetSearch()
const { m } = useI18n()

const opacity = computed(() => {
  if (!store.showPlanetHud) {
    if (store.scrollProgress >= 0.9) return 0
    if (store.scrollProgress < 0.72) return 0
  }
  if (store.scrollProgress < 0.72) return 0
  if (store.scrollProgress >= 0.9) {
    return Math.max(0, 1 - (store.scrollProgress - 0.9) / 0.03)
  }
  return Math.min(1, (store.scrollProgress - 0.72) / 0.05)
})

function select(id: string) {
  store.requestTravel(id, 'orbit')
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 z-20"
    :style="{ opacity, transform: `translateY(${(1 - opacity) * 16}px)` }"
  >
    <section
      class="absolute top-24 right-4 left-4 md:right-auto md:left-10 md:w-[300px]"
      :class="opacity > 0.2 ? 'pointer-events-auto' : 'pointer-events-none'"
    >
      <PlanetSearch />
      <ul class="mt-6 max-h-[min(52vh,420px)] space-y-0 overflow-y-auto overscroll-contain pr-1">
        <li v-for="planet in results" :key="planet.id">
          <button
            type="button"
            class="w-full py-2.5 text-left transition"
            :class="store.activePlanetId === planet.id ? 'hud-text' : 'hud-link'"
            @click="select(planet.id)"
          >
            <span class="hud-text-muted block text-[10px] tracking-[0.18em] uppercase">
              {{ planet.type }}
            </span>
            <span
              class="mt-0.5 block text-base tracking-[0.06em] md:text-lg"
              :class="store.activePlanetId === planet.id ? 'hud-underline is-active' : ''"
            >
              {{ planet.name }}
            </span>
          </button>
        </li>
        <li v-if="results.length === 0" class="hud-text-muted px-0 py-3 text-sm">
          {{ m.search.empty }}
        </li>
      </ul>
    </section>

    <TelemetryCard
      class="absolute right-4 bottom-4 left-4 md:bottom-auto md:left-auto md:w-[360px] md:top-24 md:right-10"
      :class="opacity > 0.2 ? 'pointer-events-auto' : 'pointer-events-none'"
    />
  </div>
</template>
