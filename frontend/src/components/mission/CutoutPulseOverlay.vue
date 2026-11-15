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
  const fovX = Math.max(props.fovDeg, 1e-6)
  const aspect = Number.isFinite(props.aspect) && props.aspect > 0.2 ? props.aspect : 1.6
  const fovY = fovX / aspect
  const cosDec = Math.cos((props.centerDec * Math.PI) / 180)
  const dRa = ((props.ra - props.centerRa + 540) % 360) - 180
  const dx = (dRa * cosDec) / fovX
  const dy = (props.dec - props.centerDec) / fovY
  const w = props.sizeDeg / fovX
  const h = props.sizeDeg / fovY
  const cx = 0.5 + dx
  const cy = 0.5 - dy
  return {
    left: `${(cx - w / 2) * 100}%`,
    top: `${(cy - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    onScreen: cx > -0.15 && cx < 1.15 && cy > -0.15 && cy < 1.15 && w > 0.004 && h > 0.004,
  }
})

const show = computed(
  () =>
    props.visible !== false &&
    Number.isFinite(props.ra) &&
    Number.isFinite(props.dec) &&
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
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
}

.cutout-pulse__box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(232, 196, 120, 0.95);
  border-radius: 0.15rem;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.55),
    0 0 18px rgba(232, 196, 120, 0.35);
  animation: cutout-blink 1.25s ease-in-out infinite;
}

.cutout-pulse.is-hot .cutout-pulse__box {
  border-color: #ffe9b8;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.65),
    0 0 22px rgba(255, 210, 120, 0.55);
  animation-duration: 0.85s;
}

.cutout-pulse__label {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, calc(-100% - 0.28rem));
  white-space: nowrap;
  padding: 0.12rem 0.4rem;
  border-radius: 0.25rem;
  background: rgba(5, 7, 12, 0.82);
  border: 1px solid rgba(232, 196, 120, 0.45);
  color: #ffe9b8;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@keyframes cutout-blink {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}
</style>
