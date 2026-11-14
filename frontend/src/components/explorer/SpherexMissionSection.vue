<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSpaceStore } from '@/stores/useSpaceStore'
import milkyWayUrl from '@/assets/images/8k_stars_milky_way.jpg'
import probeUrl from '@/assets/images/Sonda espacial de reflector metálico aflorado.png'

const store = useSpaceStore()
const router = useRouter()

const opacity = computed(() => {
  if (!store.showSpherexMission) return 0
  return Math.min(1, (store.scrollProgress - 0.9) / 0.04)
})

const interactive = computed(() => opacity.value > 0.35)

function onAladinClick() {
  // Navega a /mision: el Explorer (Three.js) se desmonta y Aladin se carga solo allí.
  void router.push({ name: 'mission' })
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
      :class="interactive ? 'pointer-events-auto' : 'pointer-events-none'"
    >
      <div class="relative z-10 flex flex-col items-start justify-center md:max-w-[36rem] md:pl-2">
        <p class="hud-text-muted mb-3 text-[10px] tracking-[0.36em] uppercase">
          Capítulo final · Acceso al laboratorio
        </p>
        <h2 class="hud-text mb-8 text-left text-[clamp(26px,3.4vw,42px)] leading-[1.25] tracking-[0.1em]">
          <span class="block">SphereX,</span>
          <span class="block">el observatorio espacial de la NASA</span>
        </h2>

        <button
          type="button"
          class="mission-cta group relative text-left"
          title="Abrir explorador Aladin Lite (carga diferida)"
          @click="onAladinClick"
        >
          <span class="mission-cta__glow" aria-hidden="true" />
          <span class="mission-cta__label">Abrir la misión</span>
          <span class="mission-cta__sub">Planet X and SPHEREx · cielo Aladin Lite</span>
          <span class="mission-cta__hint">Entrar al mapa estelar →</span>
        </button>
      </div>

      <div class="probe-stage relative mx-auto h-[min(56vh,480px)] w-[min(92vw,520px)] md:mx-0 md:justify-self-end">
        <div class="probe-orbit-ring absolute inset-[6%] rounded-full border border-white/12" />
        <div class="probe-orbit-ring probe-orbit-ring--slow absolute inset-[16%] rounded-full border border-white/6" />
        <div class="probe-orbit absolute inset-0 grid place-items-center">
          <img
            :src="probeUrl"
            alt="Sonda espacial SPHEREx de reflector metálico"
            class="probe-float h-[min(40vh,320px)] w-auto max-w-[78%] object-contain"
            draggable="false"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mission-cta {
  position: relative;
  isolation: isolate;
  min-width: min(100%, 28rem);
  padding: 1.15rem 1.35rem 1.05rem;
  border: 1px solid rgba(232, 196, 120, 0.55);
  background:
    linear-gradient(135deg, rgba(232, 196, 120, 0.16), rgba(0, 0, 0, 0.35) 55%),
    rgba(8, 10, 16, 0.55);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06) inset,
    0 0 36px rgba(232, 196, 120, 0.22),
    0 12px 40px rgba(0, 0, 0, 0.35);
  transition:
    border-color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.mission-cta:hover,
.mission-cta:focus-visible {
  border-color: rgba(255, 220, 150, 0.95);
  transform: translateY(-2px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 0 48px rgba(232, 196, 120, 0.38),
    0 16px 48px rgba(0, 0, 0, 0.4);
}

.mission-cta__glow {
  position: absolute;
  inset: -2px;
  z-index: -1;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(232, 196, 120, 0.45), transparent 40%, rgba(120, 170, 255, 0.2));
  opacity: 0.55;
  filter: blur(10px);
  animation: cta-pulse 2.8s ease-in-out infinite;
}

.mission-cta__label {
  display: block;
  color: #fff8e8;
  font-size: clamp(1.55rem, 3.6vw, 2.55rem);
  line-height: 1.1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.9),
    0 0 24px rgba(232, 196, 120, 0.35);
}

.mission-cta__sub {
  display: block;
  margin-top: 0.45rem;
  color: rgba(255, 236, 200, 0.82);
  font-size: clamp(0.78rem, 1.3vw, 0.95rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.mission-cta__hint {
  display: block;
  margin-top: 0.85rem;
  color: rgba(232, 196, 120, 0.95);
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

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

@keyframes cta-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.85;
  }
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
  .probe-orbit-ring,
  .mission-cta__glow {
    animation: none;
  }

  .probe-float {
    transform: rotate(18deg);
  }
}
</style>
