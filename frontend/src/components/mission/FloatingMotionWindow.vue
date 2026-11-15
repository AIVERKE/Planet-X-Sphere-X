<script setup lang="ts">
import { onUnmounted } from 'vue'
import SpherexPlayer from '@/components/mission/SpherexPlayer.vue'

const props = defineProps<{
  open: boolean
  /** Sube al incrementar: reapertura / traer al frente. */
  tick?: number
  title?: string
  /** Qué debe buscar quien mira el blink (viene del preset). */
  note?: string
  objectType?: string
  ra: number
  dec: number
  radius?: number
  cutoutSize?: number
}>()

const emit = defineEmits<{
  close: []
  focusSky: [payload: { ra: number; dec: number; fovDeg: number }]
}>()

function closeFloat(event?: Event) {
  event?.preventDefault()
  event?.stopPropagation()
  emit('close')
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) closeFloat()
}

window.addEventListener('keydown', onKey)
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <aside v-show="open" class="float" data-tour="interpret" aria-label="Blink SPHEREx">
      <header class="float__bar">
        <div class="float__drag">
          <p class="float__kicker">Blink</p>
          <h2>{{ title || 'Movimiento' }}</h2>
        </div>
        <button
          type="button"
          class="float__close"
          aria-label="Cerrar blink"
          @pointerdown.stop.prevent="closeFloat"
          @click.stop.prevent="closeFloat"
        >
          Cerrar
        </button>
      </header>

      <div class="float__body">
        <SpherexPlayer
          v-if="open"
          :note="note"
          :object-type="objectType"
          :ra="ra"
          :dec="dec"
          :radius="radius"
          :cutout-size="cutoutSize"
          @focus-sky="emit('focusSky', $event)"
        />
      </div>
  </aside>
</template>

<style scoped>
.float {
  position: absolute;
  top: 4.6rem;
  right: 0;
  bottom: 4.4rem;
  z-index: 6;
  width: 50%;
  max-height: none;
  display: flex;
  flex-direction: column;
  border: 0;
  border-left: 1px solid rgba(232, 196, 120, 0.35);
  border-radius: 0;
  background: rgba(5, 7, 12, 0.96);
  box-shadow: none;
  overflow: hidden;
  pointer-events: auto;
  container: blink / size;
}

.float__bar {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.float__drag {
  flex: 1;
  min-width: 0;
  cursor: default;
  user-select: none;
  padding: 0.2rem 0.15rem;
}

.float__kicker {
  margin: 0 0 0.12rem;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.75);
}

.float__drag h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  color: #fff;
  line-height: 1.25;
}

.float__close {
  flex: 0 0 auto;
  align-self: center;
  border: 1px solid rgba(232, 196, 120, 0.55);
  background: rgba(232, 196, 120, 0.14);
  color: #ffe9b8;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.5rem 0.7rem;
  border-radius: 0.35rem;
  cursor: pointer;
  pointer-events: auto;
  z-index: 2;
}

.float__close:hover {
  border-color: rgba(232, 196, 120, 0.9);
  background: rgba(232, 196, 120, 0.22);
}

.float__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  padding: 0.35rem 0.7rem 0.55rem;
}

@container blink (max-height: 640px) {
  .float__bar {
    padding: 0.35rem 0.6rem;
  }

  .float__drag h2 {
    font-size: 0.92rem;
  }
}

@media (max-width: 800px) {
  .float {
    top: auto;
    left: 0;
    width: 100%;
    height: 50%;
    border-left: 0;
    border-top: 1px solid rgba(232, 196, 120, 0.35);
  }
}
</style>
