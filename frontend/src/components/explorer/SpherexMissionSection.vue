<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useSpaceStore } from '@/stores/useSpaceStore'
import milkyWayUrl from '@/assets/images/8k_stars_milky_way.jpg'
import probeUrl from '@/assets/images/Sonda espacial de reflector metálico aflorado.png'

const store = useSpaceStore()
const router = useRouter()
const { m } = useI18n()

const opacity = computed(() => {
  if (!store.showSpherexMission) return 0
  return Math.min(1, (store.scrollProgress - 0.9) / 0.04)
})

const interactive = computed(() => opacity.value > 0.35)

function onAladinClick() {
  // Navega a /mision: el Explorer (Three.js) se desmonta y Aladin se carga solo allí.
  void router.push({ name: 'mission' })
}

/** El overlay no debe atrapar la rueda: solo el CTA captura clics. */
function onWheel(event: WheelEvent) {
  if (!interactive.value) return
  window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' })
}
</script>

<template>
  <section
    class="spherex-mission pointer-events-none fixed inset-0 z-[25] overflow-hidden"
    :style="{ opacity }"
    :aria-hidden="!interactive"
  >
    <div
      class="absolute inset-0 scale-105 bg-cover bg-center"
      :style="{ backgroundImage: `url(${milkyWayUrl})` }"
    />
    <div class="absolute inset-0 bg-[#03050a]/30" />
    <div
      class="absolute inset-0"
      style="background: radial-gradient(ellipse at center, transparent 28%, rgba(3, 5, 10, 0.75) 100%)"
    />

    <div
      class="absolute inset-0 grid grid-cols-1 items-center gap-8 px-6 pt-24 pb-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-6 md:px-12 lg:px-16"
    >
      <div class="relative z-10 flex flex-col items-start justify-center md:max-w-[34rem] md:pl-2">
        <h2 class="hud-text mb-8 text-left text-[clamp(26px,3.4vw,42px)] leading-[1.25] tracking-[0.1em]">
          <span class="block">{{ m.spherex.titleLine1 }}</span>
          <span class="block">{{ m.spherex.titleLine2 }}</span>
        </h2>

        <button
          type="button"
          class="aladin-btn hud-text border border-white/40 bg-black/20 px-7 py-5 text-left text-[clamp(28px,3.8vw,48px)] leading-[1.2] tracking-[0.05em] uppercase shadow-[0_0_28px_rgba(255,255,255,0.1)] transition hover:border-white/70"
          :class="interactive ? 'pointer-events-auto' : 'pointer-events-none'"
          :title="m.spherex.openTitle"
          @click="onAladinClick"
          @wheel.passive="onWheel"
        >
          <span class="block">{{ m.spherex.openLine1 }}</span>
          <span class="block">{{ m.spherex.openLine2 }}</span>
        </button>
      </div>

      <div class="probe-stage relative mx-auto h-[min(56vh,480px)] w-[min(92vw,520px)] md:mx-0 md:justify-self-end">
        <div class="probe-orbit-ring absolute inset-[6%] rounded-full border border-white/12" />
        <div class="probe-orbit-ring probe-orbit-ring--slow absolute inset-[16%] rounded-full border border-white/6" />
        <div class="probe-orbit absolute inset-0 grid place-items-center">
          <img
            :src="probeUrl"
            :alt="m.spherex.probeAlt"
            class="probe-float h-[min(40vh,320px)] w-auto max-w-[78%] object-contain"
            draggable="false"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.probe-orbit {
  animation: probe-orbit 22s linear infinite;
}

.probe-float {
  animation: probe-float 5.2s ease-in-out infinite;
  transform-origin: center center;
  mix-blend-mode: screen;
  filter: drop-shadow(0 0 22px rgba(180, 200, 255, 0.22));
}

.probe-orbit-ring {
  animation: probe-spin 32s linear infinite;
}

.probe-orbit-ring--slow {
  animation-duration: 52s;
  animation-direction: reverse;
}

@keyframes probe-orbit {
  0% {
    transform: rotate(0deg) translateX(28px) rotate(0deg);
  }
  100% {
    transform: rotate(360deg) translateX(28px) rotate(-360deg);
  }
}

@keyframes probe-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(18deg) scale(1);
  }
  33% {
    transform: translate3d(4px, -12px, 0) rotate(22deg) scale(1.02);
  }
  66% {
    transform: translate3d(-2px, -6px, 0) rotate(16deg) scale(0.99);
  }
}

@keyframes probe-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .probe-orbit,
  .probe-float,
  .probe-orbit-ring {
    animation: none;
  }

  .probe-float {
    transform: rotate(18deg);
  }
}
</style>
