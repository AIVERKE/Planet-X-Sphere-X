<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import gsap from 'gsap'
import AtmosphereBars from '@/components/explorer/AtmosphereBars.vue'
import { useI18n } from '@/composables/useI18n'
import { useLocalizedContent } from '@/composables/useLocalizedContent'
import { useSpaceStore } from '@/stores/useSpaceStore'

const store = useSpaceStore()
const { m } = useI18n()
const { activePlanet } = useLocalizedContent()

const shown = reactive({
  distanceAu: 0,
  gravity: 0,
  temperatureC: 0,
  habitability: 0,
})

watch(
  activePlanet,
  (planet) => {
    gsap.to(shown, {
      distanceAu: planet.distanceAu,
      gravity: planet.gravity,
      temperatureC: planet.temperatureC,
      habitability: planet.habitability,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : 0.7,
      ease: 'power2.out',
    })
  },
  { immediate: true },
)

const travelLabel = computed(() => {
  if (store.cameraMode === 'scroll') return m.value.telemetry.travelOrbit
  if (store.approach === 'orbit') return m.value.telemetry.travelSurface
  return m.value.telemetry.backOrbit
})

function travel() {
  if (store.cameraMode === 'scroll') {
    store.requestTravel(store.activePlanetId, 'orbit')
    return
  }
  store.requestTravel(store.activePlanetId, store.approach === 'orbit' ? 'surface' : 'orbit')
}

function formatTemp(value: number) {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded} °C`
}
</script>

<template>
  <article class="bg-transparent p-0">
    <p class="hud-text-muted text-[10px] tracking-[0.22em] uppercase">
      {{ m.telemetry.mission }}
    </p>
    <h3 class="hud-text mt-2 text-3xl font-medium tracking-[0.08em] uppercase">
      {{ activePlanet.name }}
    </h3>
    <p class="hud-text-muted mt-1 text-[12px] tracking-[0.18em] uppercase">
      {{ activePlanet.type }}
    </p>

    <dl class="mt-6 grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt class="hud-text-muted text-[10px] tracking-[0.16em] uppercase">
          {{ m.telemetry.distance }}
        </dt>
        <dd class="hud-text mt-1">
          {{ shown.distanceAu.toFixed(2) }} {{ m.telemetry.au }}
        </dd>
      </div>
      <div>
        <dt class="hud-text-muted text-[10px] tracking-[0.16em] uppercase">
          {{ m.telemetry.gravity }}
        </dt>
        <dd class="hud-text mt-1">{{ shown.gravity.toFixed(2) }} m/s²</dd>
      </div>
      <div>
        <dt class="hud-text-muted text-[10px] tracking-[0.16em] uppercase">
          {{ m.telemetry.temperature }}
        </dt>
        <dd class="hud-text mt-1">{{ formatTemp(shown.temperatureC) }}</dd>
      </div>
      <div>
        <dt class="hud-text-muted text-[10px] tracking-[0.16em] uppercase">
          {{ m.telemetry.habitability }}
        </dt>
        <dd class="hud-text mt-1">{{ Math.round(shown.habitability * 100) }}%</dd>
      </div>
    </dl>

    <div class="mt-6">
      <p class="hud-text-muted mb-3 text-[10px] tracking-[0.2em] uppercase">
        {{ m.telemetry.atmosphere }}
      </p>
      <AtmosphereBars :gases="activePlanet.atmosphere" />
    </div>

    <button
      type="button"
      class="hud-link hud-underline mt-6 pb-1 text-[11px] tracking-[0.2em] uppercase"
      @click="travel"
    >
      {{ travelLabel }}
    </button>
    <button
      v-if="store.cameraMode !== 'scroll' && store.cameraMode !== 'look'"
      type="button"
      class="hud-text-muted mt-4 block text-[11px] tracking-[0.18em] uppercase"
      @click="store.requestRail(null)"
    >
      {{ m.telemetry.backJourney }}
    </button>
  </article>
</template>
