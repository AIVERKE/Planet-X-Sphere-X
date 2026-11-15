<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Centro del recorte (SPHEREx / WISE). */
  ra: number
  dec: number
  /** Lado del recorte en grados. */
  sizeDeg: number
  /** Centro actual del atlas. */
  centerRa: number
  centerDec: number
  /** FOV horizontal del atlas (deg). */
  fovDeg: number
  /** Ancho / alto del canvas. */
  aspect: number
  visible?: boolean
  /** Texto corto bajo el marco. */
  label?: string
  /** Más intenso cuando el blink está abierto. */
  emphasized?: boolean
}>()

/**
 * Proyección local: offset en RA/Dec → fracción de la vista Aladin.
 * Suficiente para FOVs típicos del atlas (minutos a pocos grados).
 */
const box = computed(() => {
  const fovX = Math.max(Number(props.fovDeg) || 0.4, 1e-6)
  const aspect = Number.isFinite(props.aspect) && props.aspect > 0.2 ? props.aspect : 1.6
  const fovY = fovX / aspect
  const cosDec = Math.cos((props.centerDec * Math.PI) / 180) || 1
  const dRa = ((props.ra - props.centerRa + 540) % 360) - 180
  const dx = (dRa * cosDec) / fovX
  const dy = (props.dec - props.centerDec) / fovY
  // Mínimo ~5% de la vista para que siempre se note, aunque el FOV sea amplio.
  const w = Math.max(props.sizeDeg / fovX, 0.05)
  const h = Math.max(props.sizeDeg / fovY, 0.05)
  const cx = 0.5 + dx
  const cy = 0.5 - dy
  return {
    left: `${(cx - w / 2) * 100}%`,
    top: `${(cy - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    onScreen: Number.isFinite(cx) && Number.isFinite(cy) && cx > -0.4 && cx < 1.4 && cy > -0.4 && cy < 1.4,
  }
})

const show = computed(
  () =>
    props.visible !== false &&
    Number.isFinite(props.ra) &&
    Number.isFinite(props.dec) &&
    Number.isFinite(props.centerRa) &&
    Number.isFinite(props.centerDec) &&
    Number.isFinite(props.sizeDeg) &&
    props.sizeDeg > 0 &&
    box.value.onScreen,
)
</script>

<template>
  <div
    v-show="show"
    class="cutout-pulse"
    :class="{ 'is-hot': emphasized }"
    aria-hidden="true"
  >
    <div
      class="cutout-pulse__box"
      :style="{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }"
    >
      <span v-if="label" class="cutout-pulse__label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.cutout-pulse {
  position: absolute;
  inset: 0;
  /* Por encima del blink (z=5) para no quedar tapado. */
  z-index: 12;
  pointer-events: none;
  overflow: hidden;
}

.cutout-pulse__box {
  position: absolute;
  box-sizing: border-box;
  min-width: 2.5rem;
  min-height: 2.5rem;
  border: 2px solid #e8c478;
  border-radius: 0.2rem;
  background: rgba(232, 196, 120, 0.08);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.7),
    0 0 16px rgba(232, 196, 120, 0.55);
  animation: cutout-blink 1.1s ease-in-out infinite;
}

.cutout-pulse.is-hot .cutout-pulse__box {
  border-color: #ffe9b8;
  background: rgba(255, 233, 184, 0.1);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.75),
    0 0 24px rgba(255, 210, 120, 0.7);
  animation-duration: 0.75s;
}

.cutout-pulse__label {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, calc(-100% - 0.28rem));
  white-space: nowrap;
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  background: rgba(5, 7, 12, 0.9);
  border: 1px solid rgba(232, 196, 120, 0.55);
  color: #ffe9b8;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  animation: cutout-blink 1.1s ease-in-out infinite;
}

@keyframes cutout-blink {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}
</style>
