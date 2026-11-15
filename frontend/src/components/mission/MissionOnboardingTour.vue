<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { MissionTourStepId } from '@/composables/useMissionOnboarding'

const props = defineProps<{
  active: boolean
  stepId: MissionTourStepId
  stepIndex: number
  stepCount: number
  isFirst: boolean
  isLast: boolean
  targetRect: DOMRect | null
  title: string
  body: string
  skipLabel: string
  nextLabel: string
  backLabel: string
  doneLabel: string
  progressLabel: string
}>()

const emit = defineEmits<{
  next: []
  prev: []
  skip: []
  remount: []
}>()

const MARGIN = 12
/** Altura estimada de la tarjeta (título + cuerpo + acciones). */
const CARD_H_EST = 210

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** Spotlight acotado: paneles altos no deben cubrir casi toda la pantalla. */
const hole = computed(() => {
  const r = props.targetRect
  if (!r || r.width < 4 || r.height < 4) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = 8
  const maxW = Math.min(vw - MARGIN * 2, Math.max(r.width + pad * 2, 120), vw * 0.52)
  const maxH = Math.min(vh - MARGIN * 2, Math.max(r.height + pad * 2, 72), vh * 0.42)

  const width = Math.min(r.width + pad * 2, maxW)
  const height = Math.min(r.height + pad * 2, maxH)
  const cx = r.left + r.width / 2
  const cy = r.top + Math.min(r.height / 2, maxH / 2)

  return {
    top: clamp(cy - height / 2, MARGIN, vh - height - MARGIN),
    left: clamp(cx - width / 2, MARGIN, vw - width - MARGIN),
    width,
    height,
  }
})

const cardStyle = computed(() => {
  const r = props.targetRect
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(360, vw - MARGIN * 2)
  const maxTop = vh - CARD_H_EST - MARGIN

  if (!r) {
    return {
      top: `${Math.max(MARGIN, (vh - CARD_H_EST) / 2)}px`,
      left: `${Math.max(MARGIN, (vw - cardW) / 2)}px`,
      width: `${cardW}px`,
      transform: 'none',
    }
  }

  const tall = r.height > vh * 0.38
  const onRight = r.left + r.width / 2 > vw * 0.55
  const onLeft = r.left + r.width / 2 < vw * 0.45

  let top: number
  let left: number
  let transform = 'none'

  if (tall || onRight || onLeft) {
    // Al lado del ancla (paneles laterales / float alto).
    if (onRight) {
      left = r.left - cardW - 14
      if (left < MARGIN) left = MARGIN
    } else {
      left = r.right + 14
      if (left + cardW > vw - MARGIN) left = vw - cardW - MARGIN
    }
    top = clamp(r.top + 8, MARGIN, maxTop)
  } else {
    const spaceBelow = vh - r.bottom
    const spaceAbove = r.top
    const placeBelow = spaceBelow >= CARD_H_EST + 20 || spaceBelow >= spaceAbove

    if (placeBelow) {
      top = clamp(r.bottom + 12, MARGIN, maxTop)
    } else {
      top = clamp(r.top - 12, MARGIN + CARD_H_EST, vh - MARGIN)
      transform = 'translateY(-100%)'
      // Si al subir se sale, forzar dentro del viewport.
      if (r.top - 12 - CARD_H_EST < MARGIN) {
        top = MARGIN
        transform = 'none'
      }
    }
    left = clamp(r.left + r.width / 2 - cardW / 2, MARGIN, vw - cardW - MARGIN)
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${cardW}px`,
    transform,
    maxHeight: `${Math.min(CARD_H_EST + 40, vh - MARGIN * 2)}px`,
  }
})

function onKey(event: KeyboardEvent) {
  if (!props.active) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('skip')
  } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
    event.preventDefault()
    emit('next')
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('prev')
  }
}

function onResize() {
  emit('remount')
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div
    v-if="active"
    class="tour"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
  >
    <div
      class="tour__catch"
      :class="{ 'tour__catch--dim': !hole }"
      @click="emit('skip')"
    />
    <div
      v-if="hole"
      class="tour__hole"
      :style="{
        top: `${hole.top}px`,
        left: `${hole.left}px`,
        width: `${hole.width}px`,
        height: `${hole.height}px`,
      }"
    />
    <div class="tour__card" :style="cardStyle">
      <p class="tour__progress">{{ progressLabel }}</p>
      <h2 class="tour__title">{{ title }}</h2>
      <p class="tour__body">{{ body }}</p>
      <div class="tour__actions">
        <button type="button" class="tour__btn tour__btn--ghost" @click="emit('skip')">
          {{ skipLabel }}
        </button>
        <div class="tour__nav">
          <button
            v-if="!isFirst"
            type="button"
            class="tour__btn"
            @click="emit('prev')"
          >
            {{ backLabel }}
          </button>
          <button type="button" class="tour__btn tour__btn--gold" @click="emit('next')">
            {{ isLast ? doneLabel : nextLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.tour__catch {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: transparent;
}

.tour__catch--dim {
  background: rgba(0, 8, 14, 0.62);
}

.tour__hole {
  position: absolute;
  border-radius: 10px;
  box-shadow:
    0 0 0 9999px rgba(0, 8, 14, 0.62),
    0 0 0 2px rgba(232, 196, 120, 0.85);
  pointer-events: none;
  z-index: 1;
}

.tour__card {
  position: absolute;
  z-index: 2;
  pointer-events: auto;
  padding: 1rem 1.05rem 0.95rem;
  border: 1px solid rgba(232, 196, 120, 0.45);
  border-radius: 10px;
  background: linear-gradient(160deg, rgba(12, 22, 28, 0.96), rgba(8, 14, 18, 0.94));
  color: #f7f5f1;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  font-family: 'Urbanist', system-ui, sans-serif;
  overflow: auto;
}

.tour__progress {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.75);
}

.tour__title {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

.tour__body {
  margin: 0.55rem 0 0;
  font-size: 0.92rem;
  line-height: 1.45;
  color: rgba(247, 245, 241, 0.88);
}

.tour__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
}

.tour__nav {
  display: flex;
  gap: 0.45rem;
}

.tour__btn {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  padding: 0.5rem 0.75rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.tour__btn--gold {
  border-color: rgba(232, 196, 120, 0.75);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.16);
}

.tour__btn--ghost {
  border-color: transparent;
  background: transparent;
  color: rgba(247, 245, 241, 0.7);
  padding-left: 0;
}
</style>
