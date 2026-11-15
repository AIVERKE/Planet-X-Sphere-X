<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import LanguageToggle from '@/components/common/LanguageToggle.vue'
import { useI18n } from '@/composables/useI18n'
import {
  loadAladinLite,
  type AladinInstance,
} from '@/services/loadAladinLite'
import '@/styles/explorer.css'

const router = useRouter()
const { m } = useI18n()
const host = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')

const aladinRef = shallowRef<AladinInstance | null>(null)

/** Centro galáctico — cielo profundo, sin apuntar a la Tierra. */
const DEEP_SPACE = {
  survey: 'P/Mellinger/color',
  /** Sagittarius A* (centro de la Vía Láctea) */
  target: '266.4168 -29.0078',
  fov: 110,
} as const

async function boot() {
  if (!host.value) return
  status.value = 'loading'
  errorMessage.value = ''

  try {
    const A = await loadAladinLite()
    if (!host.value) return

    host.value.innerHTML = ''
    const aladin = A.aladin('#aladin-lite-host', {
      survey: DEEP_SPACE.survey,
      target: DEEP_SPACE.target,
      fov: DEEP_SPACE.fov,
      projection: 'SIN',
      cooFrame: 'ICRSd',
      showReticle: false,
      showFrame: false,
      showCooGrid: false,
      showGotoControl: false,
      showFullscreenControl: false,
      showLayersControl: false,
      showProjectionControl: false,
      showFrameColorPicker: false,
      showSimbadPointerControl: false,
      showShareControl: false,
      showCatalog: false,
      showZoomControl: true,
      fullScreen: false,
      realFullscreen: false,
      backgroundColor: 'rgb(0,0,0)',
    })

    aladinRef.value = aladin
    status.value = 'ready'
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error ? error.message : m.value.mission.errorFallback
  }
}

function goBack() {
  void router.push({ name: 'explorer' })
}

onMounted(() => {
  document.documentElement.classList.add('is-explorer')
  document.documentElement.classList.remove('is-look-locked')
  void boot()
})

onUnmounted(() => {
  try {
    aladinRef.value?.remove?.()
  } catch {
    /* ignore */
  }
  aladinRef.value = null
  if (host.value) host.value.innerHTML = ''
  document.documentElement.classList.remove('is-explorer')
})
</script>

<template>
  <div class="mission-root fixed inset-0 z-50 bg-black text-white">
    <div
      id="aladin-lite-host"
      ref="host"
      class="absolute inset-0 h-full w-full"
      :aria-label="m.mission.aladinAria"
    />

    <header class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-5 md:p-8">
      <div>
        <p class="hud-text-muted text-[10px] tracking-[0.32em] uppercase">
          {{ m.mission.eyebrow }}
        </p>
        <h1 class="hud-text mt-2 text-[clamp(18px,2.4vw,28px)] tracking-[0.12em] uppercase">
          {{ m.mission.title }}
        </h1>
      </div>
      <div class="pointer-events-auto flex flex-col items-end gap-3">
        <LanguageToggle />
        <button
          type="button"
          class="hud-link hud-underline pb-1 text-[11px] tracking-[0.24em] uppercase"
          @click="goBack"
        >
          {{ m.mission.back }}
        </button>
      </div>
    </header>

    <div
      v-if="status === 'loading'"
      class="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/70"
    >
      <p class="hud-text text-[12px] tracking-[0.28em] uppercase">
        {{ m.mission.loading }}
      </p>
    </div>

    <div
      v-else-if="status === 'error'"
      class="absolute inset-0 z-10 grid place-items-center bg-black/85 px-6"
    >
      <div class="max-w-md text-center">
        <p class="hud-text text-[13px] tracking-[0.2em] uppercase">
          {{ m.mission.errorTitle }}
        </p>
        <p class="hud-text-muted mt-3 text-sm leading-relaxed">
          {{ errorMessage }}
        </p>
        <button
          type="button"
          class="hud-link hud-underline mt-6 pb-1 text-[11px] tracking-[0.22em] uppercase"
          @click="boot"
        >
          {{ m.mission.retry }}
        </button>
      </div>
    </div>

    <p
      v-if="status === 'ready'"
      class="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 text-center hud-text-muted text-[10px] tracking-[0.22em] uppercase"
    >
      {{ m.mission.hint }}
    </p>
  </div>
</template>

<style scoped>
.mission-root :deep(.aladin-container),
.mission-root :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
}

/* Controles nativos de Aladin: fondos blancos → transparentes */
.mission-root :deep(button),
.mission-root :deep(.aladin-btn),
.mission-root :deep(.aladin-stack-control),
.mission-root :deep(.aladin-zoom-control),
.mission-root :deep(.aladin-fullscreen-control),
.mission-root :deep(.aladin-location),
.mission-root :deep(.aladin-measurement-control),
.mission-root :deep([class*='aladin-'] button),
.mission-root :deep(.css-control),
.mission-root :deep(.css-button) {
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
  color: rgba(244, 247, 251, 0.9) !important;
}

.mission-root :deep(button:hover),
.mission-root :deep(.aladin-btn:hover),
.mission-root :deep([class*='aladin-'] button:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.55) !important;
}

.mission-root :deep(select),
.mission-root :deep(input),
.mission-root :deep(.aladin-location) {
  background: rgba(0, 0, 0, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  color: #f4f7fb !important;
}
</style>
