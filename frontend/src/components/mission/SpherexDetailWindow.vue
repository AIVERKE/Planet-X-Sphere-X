<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { apiUrl } from '@/services/http'
import { bandLabel, formatRaDec, mjdToHint, shortObsId } from '@/utils/skyFormat'

const { m } = useI18n()
const ui = computed(() => m.value.mission.ui)
const detail = computed(() => m.value.mission.detail)

export type DetailObs = {
  obs_id?: unknown
  energy_bandpassname?: unknown
  t_min?: unknown
  t_max?: unknown
  s_ra?: unknown
  s_dec?: unknown
  ra?: unknown
  dec?: unknown
  cutout_url?: unknown
  access_url?: unknown
  collection?: unknown
  instrument_name?: unknown
  facility_name?: unknown
  o_ucd?: unknown
  s_fov?: unknown
}

const props = defineProps<{
  open: boolean
  tick?: number
  obs: DetailObs | null
  cutoutSize?: number
  /** PNG ya listo (p. ej. desde el blink). */
  pngUrl?: string | null
  pngUrlHd?: string | null
}>()

const emit = defineEmits<{
  close: []
  focusSky: [payload: { ra: number; dec: number; fovDeg: number }]
  openBlink: []
  openExternal: [url: string]
}>()

const root = ref<HTMLElement | null>(null)
const pos = ref({ x: 40, y: 72 })
const layer = ref(90)
const dragging = ref(false)
const showHd = ref(true)
let dragOx = 0
let dragOy = 0

const ra = computed(() => {
  const v = Number(props.obs?.s_ra ?? props.obs?.ra)
  return Number.isFinite(v) ? v : null
})
const dec = computed(() => {
  const v = Number(props.obs?.s_dec ?? props.obs?.dec)
  return Number.isFinite(v) ? v : null
})

const cutoutUrl = computed(() =>
  typeof props.obs?.cutout_url === 'string' ? props.obs.cutout_url : null,
)
const accessUrl = computed(() =>
  typeof props.obs?.access_url === 'string' ? props.obs.access_url : null,
)

/** PNG bajo demanda si no viene del blink (el API auto-estira). */
const builtPng = computed(() => {
  if (!cutoutUrl.value || ra.value == null || dec.value == null) return null
  const size = props.cutoutSize ?? 0.08
  const q = new URLSearchParams({
    url: cutoutUrl.value,
    ra: String(ra.value),
    dec: String(dec.value),
    size: String(size),
    style: showHd.value ? 'hd' : 'raw',
  })
  return `/api/cutouts/png?${q.toString()}`
})

const imageSrc = computed(() => {
  if (showHd.value && props.pngUrlHd) return apiUrl(props.pngUrlHd)
  if (!showHd.value && props.pngUrl) return apiUrl(props.pngUrl)
  if (props.pngUrlHd || props.pngUrl) {
    return apiUrl((showHd.value ? props.pngUrlHd : props.pngUrl) || props.pngUrl || props.pngUrlHd || '')
  }
  return builtPng.value ? apiUrl(builtPng.value) : null
})

const metaRows = computed(() => {
  const o = props.obs
  if (!o) return []
  const rows: { label: string; value: string }[] = []
  const id = shortObsId(o.obs_id)
  if (id && id !== '—') rows.push({ label: 'obs_id', value: String(o.obs_id ?? id) })
  rows.push({ label: detail.value.band, value: bandLabel(o.energy_bandpassname) })
  rows.push({ label: ui.value.epoch, value: mjdToHint(o.t_min) })
  if (o.t_min != null) rows.push({ label: 'MJD', value: String(o.t_min) })
  if (ra.value != null && dec.value != null) {
    rows.push({ label: 'Coords', value: formatRaDec(ra.value, dec.value) })
  }
  if (o.facility_name) rows.push({ label: detail.value.facility, value: String(o.facility_name) })
  if (o.instrument_name) {
    rows.push({ label: detail.value.instrument, value: String(o.instrument_name) })
  }
  if (o.collection) {
    rows.push({ label: detail.value.collection, value: String(o.collection) })
  }
  rows.push({ label: detail.value.origin, value: detail.value.originValue })
  return rows
})

function defaultPos() {
  const width = Math.min(420, window.innerWidth - 20)
  return {
    x: Math.max(12, Math.round((window.innerWidth - width) / 2)),
    y: 64,
  }
}

function bringVisible() {
  pos.value = defaultPos()
  layer.value += 1
}

function closeFloat(event?: Event) {
  event?.preventDefault()
  event?.stopPropagation()
  dragging.value = false
  emit('close')
}

watch(
  () => [props.open, props.tick] as const,
  ([open]) => {
    if (open) {
      showHd.value = true
      bringVisible()
    }
  },
  { immediate: true },
)

function onPointerDown(event: PointerEvent) {
  if (!root.value || event.button !== 0) return
  dragging.value = true
  layer.value += 1
  dragOx = event.clientX - pos.value.x
  dragOy = event.clientY - pos.value.y
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const maxX = Math.max(16, window.innerWidth - 260)
  const maxY = Math.max(16, window.innerHeight - 100)
  pos.value = {
    x: Math.min(maxX, Math.max(8, event.clientX - dragOx)),
    y: Math.min(maxY, Math.max(8, event.clientY - dragOy)),
  }
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  try {
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  } catch {
    /* ignore */
  }
}

function focusAtlas() {
  if (ra.value == null || dec.value == null) return
  emit('focusSky', { ra: ra.value, dec: dec.value, fovDeg: Math.max(0.25, (props.cutoutSize ?? 0.08) * 3) })
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) closeFloat()
}

window.addEventListener('keydown', onKey)
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <aside
      v-show="open && obs"
      ref="root"
      class="detail"
      role="dialog"
      :aria-label="detail.aria"
      :style="{ transform: `translate(${pos.x}px, ${pos.y}px)`, zIndex: layer }"
    >
      <header class="detail__bar">
        <div
          class="detail__drag"
          :title="detail.drag"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <p class="detail__kicker">{{ detail.kicker }}</p>
          <h2>{{ shortObsId(obs?.obs_id) }}</h2>
        </div>
        <button type="button" class="detail__close" @pointerdown.stop.prevent="closeFloat" @click.stop.prevent="closeFloat">
          {{ ui.close }}
        </button>
      </header>

      <div class="detail__body">
        <div class="detail__view">
          <div class="detail__toggle" role="group" :aria-label="detail.style">
            <button type="button" :class="{ 'is-on': !showHd }" @click="showHd = false">{{ detail.raw }}</button>
            <button type="button" :class="{ 'is-on': showHd }" @click="showHd = true">HD</button>
          </div>
          <div class="detail__frame">
            <img v-if="imageSrc" :src="imageSrc" :alt="`SPHEREx ${shortObsId(obs?.obs_id)}`" />
            <p v-else class="detail__empty">{{ detail.emptyCutout }}</p>
          </div>
        </div>

        <dl class="detail__meta">
          <div v-for="row in metaRows" :key="row.label" class="detail__row">
            <dt>{{ row.label }}</dt>
            <dd :title="row.value">{{ row.value }}</dd>
          </div>
        </dl>

        <div class="detail__actions">
          <button type="button" class="detail__btn detail__btn--gold" :disabled="ra == null" @click="focusAtlas">
            Atlas
          </button>
          <button type="button" class="detail__btn" @click="emit('openBlink')">Blink</button>
          <button
            v-if="cutoutUrl"
            type="button"
            class="detail__btn"
            @click="emit('openExternal', cutoutUrl)"
          >
            Cutout IRSA
          </button>
          <button
            v-if="accessUrl"
            type="button"
            class="detail__btn"
            @click="emit('openExternal', accessUrl)"
          >
            FITS
          </button>
        </div>
      </div>
    </aside>
  </Teleport>
</template>

<style scoped>
.detail {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 90;
  width: min(26rem, calc(100vw - 1rem));
  max-height: min(90vh, 44rem);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(232, 196, 120, 0.5);
  border-radius: 0.9rem;
  background: rgba(5, 7, 12, 0.96);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(18px);
  overflow: hidden;
  pointer-events: auto;
}

.detail__bar {
  display: flex;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.detail__drag {
  flex: 1;
  min-width: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.detail__drag:active {
  cursor: grabbing;
}

.detail__kicker {
  margin: 0 0 0.1rem;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.75);
}

.detail__drag h2 {
  margin: 0;
  font-size: 0.95rem;
  color: #fff;
  word-break: break-all;
}

.detail__close {
  align-self: center;
  border: 1px solid rgba(232, 196, 120, 0.55);
  background: rgba(232, 196, 120, 0.14);
  color: #ffe9b8;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.45rem 0.65rem;
  border-radius: 0.35rem;
  cursor: pointer;
}

.detail__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.7rem 0.8rem 0.9rem;
  display: grid;
  gap: 0.75rem;
}

.detail__toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
  margin-bottom: 0.45rem;
  padding: 0.2rem;
  border-radius: 0.45rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.detail__toggle button {
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  padding: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 0.3rem;
  cursor: pointer;
}

.detail__toggle button.is-on {
  color: #ffe9b8;
  border-color: rgba(232, 196, 120, 0.5);
  background: rgba(232, 196, 120, 0.14);
}

.detail__frame {
  aspect-ratio: 1;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.detail__frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.detail__empty {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.85rem;
}

.detail__meta {
  margin: 0;
  display: grid;
  gap: 0.35rem;
}

.detail__row {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: 0.4rem;
  font-size: 0.78rem;
}

.detail__row dt {
  margin: 0;
  color: rgba(255, 233, 184, 0.7);
  letter-spacing: 0.04em;
}

.detail__row dd {
  margin: 0;
  color: rgba(255, 255, 255, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail__actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.35rem;
}

.detail__btn {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  padding: 0.5rem 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 0.35rem;
  cursor: pointer;
}

.detail__btn--gold {
  border-color: rgba(232, 196, 120, 0.6);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.12);
}

.detail__btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
