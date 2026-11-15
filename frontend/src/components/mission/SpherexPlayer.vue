<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiUrl } from '@/services/http'
import { fetchSpherexFrames, type SpherexFrame } from '@/services/spherexFrames'
import { useFramePlayer } from '@/composables/useFramePlayer'
import { mjdToIso, shortObsId } from '@/utils/skyFormat'

const DETECTORS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const

const props = defineProps<{
  ra: number
  dec: number
  radius?: number
  cutoutSize?: number
  note?: string
  objectType?: string
}>()

const emit = defineEmits<{
  /** Pedir al atlas Aladin que centre/zoomee al mismo campo del cutout. */
  focusSky: [payload: { ra: number; dec: number; fovDeg: number }]
}>()

const frames = ref<SpherexFrame[]>([])
const availableBands = ref<string[]>([])
const band = ref<string | null>(null)
const matched = ref(0)
const phase = ref<'idle' | 'meta' | 'images' | 'ready' | 'error'>('idle')
const loadedImages = ref(0)
const hdReady = ref(0)
const skipped = ref(0)
const errorMessage = ref('')
const metaHint = ref('Consultando IRSA…')
let loadToken = 0

const frameCount = computed(() => frames.value.length)
const { index, playing, msPerFrame, play, toggle, select, next, prev, reset } =
  useFramePlayer(frameCount)
const active = computed(() => frames.value[index.value] ?? null)
const progress = computed(() => {
  if (!frames.value.length) return 0
  return Math.round((loadedImages.value / frames.value.length) * 100)
})
const hdProgress = computed(() => {
  if (!frames.value.length) return 0
  return Math.round((hdReady.value / frames.value.length) * 100)
})

const kindLine = computed(() => {
  const kind = props.objectType || ''
  if (kind === 'variable_star') return 'Estrella variable: mira el brillo, no el sitio'
  if (kind === 'survey_region') return 'Campo infrarrojo: cada mancha es una fuente'
  if (kind) return 'Fuente puntual: cabe en una muestra de SPHEREx'
  return 'Cada mancha es una medida infrarroja'
})

const scaleLine = computed(() => {
  const arcsec = Math.round((props.cutoutSize ?? 0.08) * 3600)
  return `Cuadro de ${arcsec}″ · cada muestra mide unos 6″`
})

const overlay = computed(() => {
  const frame = active.value
  if (!frame) return ''
  const mjd = Number.isFinite(frame.t_min) ? frame.t_min.toFixed(2) : '—'
  return `${mjdToIso(frame.t_min)} · MJD ${mjd} · ${frame.band} · ${shortObsId(frame.obs_id)}`
})

function classify(error: unknown): string {
  const msg = error instanceof Error ? error.message : 'No se pudieron cargar los cuadros SPHEREx'
  if (msg.includes('HTTP 404')) {
    return 'No hay observaciones SPHEREx en esta posición para el detector elegido.'
  }
  if (msg.includes('HTTP 503') || msg.includes('Tiempo agotado')) {
    return 'IRSA no respondió. El servicio a veces se satura; reintenta en unos segundos.'
  }
  return msg
}

function preloadOne(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No se pudo cargar un cuadro PNG'))
    image.src = src
  })
}

/** HD en segundo plano; no bloquea el play. */
async function warmHd(frameList: SpherexFrame[], token: number) {
  hdReady.value = 0
  for (const frame of frameList) {
    if (token !== loadToken) return
    try {
      await preloadOne(apiUrl(frame.png_url_hd || frame.png_url))
    } catch {
      /* ignore */
    }
    if (token === loadToken) hdReady.value += 1
  }
}

async function load() {
  const token = ++loadToken
  reset()
  frames.value = []
  skipped.value = 0
  phase.value = 'meta'
  errorMessage.value = ''
  loadedImages.value = 0
  hdReady.value = 0
  metaHint.value = `Pidiendo SPHEREx en este punto · AR ${props.ra.toFixed(3)}° · Dec ${props.dec.toFixed(3)}°`

  try {
    const result = await fetchSpherexFrames({
      ra: props.ra,
      dec: props.dec,
      radius: props.radius,
      cutoutSize: props.cutoutSize,
      band: band.value,
    })
    if (token !== loadToken) return
    frames.value = result.frames
    availableBands.value = result.available_bands
    matched.value = result.matched
    band.value = result.band
    phase.value = 'images'
    metaHint.value = `Bajando la primera época · ${result.returned} en este punto`
    let started = false
    const ok = await Promise.all(
      result.frames.map(async (frame, i) => {
        try {
          await preloadOne(apiUrl(frame.png_url))
          if (token !== loadToken) return true
          loadedImages.value += 1
          if (!started) {
            started = true
            frames.value = result.frames
            phase.value = 'ready'
            if (result.frames.length >= 2) play()
          }
          return true
        } catch {
          if (token === loadToken) loadedImages.value += 1
          return false
        }
      }),
    )
    if (token !== loadToken) return
    const usable = result.frames.filter((_, i) => ok[i])
    skipped.value = result.frames.length - usable.length
    if (!usable.length) throw new Error('No se pudo cargar ningún cuadro PNG')
    frames.value = usable
    phase.value = 'ready'
    void warmHd(usable, token)
  } catch (error) {
    if (token !== loadToken) return
    errorMessage.value = classify(error)
    phase.value = 'error'
    frames.value = []
  }
}

function onSlide(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) select(value)
}

function selectBand(code: string) {
  if (phase.value === 'meta' || phase.value === 'images') return
  if (band.value === code && frames.value.length) return
  band.value = code
  void load()
}

function hdSrc(frame: SpherexFrame): string {
  // warmHd carga en orden; hasta entonces el panel derecho usa raw.
  if (hdReady.value <= index.value) return apiUrl(frame.png_url)
  return apiUrl(frame.png_url_hd || frame.png_url)
}

/** Clic → el atlas va al mismo parche de cielo (contexto óptico DSS). */
function focusOnSky() {
  const size = props.cutoutSize ?? 0.08
  emit('focusSky', {
    ra: props.ra,
    dec: props.dec,
    fovDeg: Math.max(0.25, size * 3),
  })
}

watch(
  () =>
    [
      Math.round(props.ra * 1e4) / 1e4,
      Math.round(props.dec * 1e4) / 1e4,
      props.radius ?? 0,
      props.cutoutSize ?? 0,
    ] as const,
  () => {
    band.value = null
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <div class="player">
    <p class="player__lead">{{ kindLine }} · {{ scaleLine }}</p>
    <p v-if="note" class="player__note">{{ note }}</p>

    <div class="player__bands" role="group" aria-label="Detector">
      <button
        v-for="code in DETECTORS"
        :key="code"
        type="button"
        class="player__band"
        :class="{
          'is-on': band === code,
          'is-off': availableBands.length > 0 && !availableBands.includes(code),
        }"
        :disabled="phase === 'meta' || phase === 'images'"
        @click="selectBand(code)"
      >
        {{ code }}
      </button>
    </div>

    <p v-if="phase === 'meta'" class="player__meta">{{ metaHint }}</p>
    <div v-else-if="phase === 'images'" class="player__progress">
      <p class="player__meta">Cargando satélite {{ loadedImages }} / {{ frames.length }}</p>
      <div class="player__bar" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${progress}%` }" />
      </div>
    </div>
    <div v-else-if="phase === 'error'" class="player__err">
      <p>{{ errorMessage }}</p>
      <button type="button" class="player__go" @click="load">Reintentar</button>
    </div>

    <template v-if="active && phase !== 'error'">
      <div class="player__controls">
        <button type="button" class="player__go" :disabled="frames.length < 2" @click="toggle()">
          {{ playing ? 'Pausa' : 'Play' }}
        </button>
        <button type="button" class="player__step" :disabled="!frames.length" @click="prev()">
          Anterior
        </button>
        <button type="button" class="player__step" :disabled="!frames.length" @click="next()">
          Siguiente
        </button>
        <label>
          ms
          <input v-model.number="msPerFrame" type="number" min="200" max="4000" step="100" />
        </label>
      </div>

      <label class="player__slider">
        <input
          type="range"
          min="0"
          :max="Math.max(frames.length - 1, 0)"
          :value="index"
          :disabled="frames.length < 2"
          @input="onSlide"
        />
        <span>
          {{ index + 1 }} / {{ frames.length }}
          <template v-if="matched > frames.length"> · {{ matched }} épocas</template>
          <template v-if="skipped"> · {{ skipped }} sin cargar</template>
          <template v-if="hdReady < frames.length"> · HD {{ hdProgress }}%</template>
        </span>
      </label>

      <div class="player__duo" aria-label="Satélite y render HD en el mismo blink">
        <figure class="player__frame player__frame--sat">
          <span class="player__tag">SPHEREx · satélite</span>
          <button
            type="button"
            class="player__shot"
            title="Ver este campo en el atlas Aladin"
            @click="focusOnSky"
          >
            <img :src="apiUrl(active.png_url)" :alt="`SPHEREx raw ${active.band}`" />
          </button>
          <figcaption>{{ overlay }} · clic → atlas</figcaption>
        </figure>
        <figure class="player__frame player__frame--hd">
          <span class="player__tag">Lectura IR · misma época</span>
          <button
            type="button"
            class="player__shot"
            title="Ver este campo en el atlas Aladin"
            @click="focusOnSky"
          >
            <img :src="hdSrc(active)" :alt="`SPHEREx HD ${active.band}`" />
          </button>
          <figcaption>
            <template v-if="hdReady >= frames.length">Mismos píxeles · núcleo relleno · clic → atlas</template>
            <template v-else>Suavizando {{ hdReady }}/{{ frames.length }}…</template>
          </figcaption>
        </figure>
      </div>
    </template>
  </div>
</template>

<style scoped>
.player {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.player__lead,
.player__meta,
.player__note {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
}

.player__note {
  margin-top: 0.2rem;
  color: #ffe9b8;
}

.player__bands {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.3rem;
  margin-top: 0.45rem;
  flex: none;
}

.player__band,
.player__step {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  padding: 0.4rem 0.2rem;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.player__band.is-on {
  border-color: rgba(232, 196, 120, 0.7);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.12);
  animation: band-pulse 2.3s ease-in-out infinite;
}

@keyframes band-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(232, 196, 120, 0);
  }
  50% {
    box-shadow: 0 0 0 2px rgba(232, 196, 120, 0.16), 0 0 12px rgba(232, 196, 120, 0.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .player__band.is-on {
    animation: none;
  }
}

.player__band.is-off {
  opacity: 0.45;
}

.player__band:disabled,
.player__step:disabled,
.player__go:disabled {
  cursor: default;
  opacity: 0.45;
}

.player__err {
  margin-top: 0.85rem;
  color: #fda4af;
  display: grid;
  gap: 0.6rem;
  font-size: 0.95rem;
}

.player__err p {
  margin: 0;
}

.player__progress {
  margin-top: 0.35rem;
}

.player__bar {
  margin-top: 0.4rem;
  height: 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.player__bar span {
  display: block;
  height: 100%;
  background: #e8c478;
}

.player__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0.5rem 0 0.25rem;
  flex: none;
}

.player__go {
  border: 1px solid rgba(232, 196, 120, 0.7);
  background: rgba(232, 196, 120, 0.16);
  color: #ffe9b8;
  padding: 0.45rem 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.78rem;
  cursor: pointer;
}

.player__controls label,
.player__slider {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.player__controls input[type='number'] {
  width: 4.2rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 0.35rem;
}

.player__slider {
  margin: 0.3rem 0 0.45rem;
  flex: none;
}

.player__slider input[type='range'] {
  flex: 1;
  height: 1rem;
  margin: 0.2rem 0;
  accent-color: #e8c478;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.player__slider input[type='range']::-webkit-slider-runnable-track {
  height: 0.28rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.player__slider input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 0.85rem;
  height: 0.85rem;
  margin-top: -0.28rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 233, 184, 0.9);
  background: #e8c478;
  box-shadow: none;
}

.player__slider input[type='range']::-moz-range-track {
  height: 0.28rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  border: 0;
}

.player__slider input[type='range']::-moz-range-thumb {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 233, 184, 0.9);
  background: #e8c478;
}

.player__duo {
  flex: 1 1 auto;
  min-height: 9rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 0.45rem;
  align-items: stretch;
}

.player__frame {
  margin: 0;
  min-height: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  justify-items: stretch;
  gap: 0.28rem;
}

.player__tag {
  width: 100%;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #ffe9b8;
  text-align: center;
}

.player__shot {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: #000;
  cursor: zoom-in;
  overflow: hidden;
}

.player__shot:focus-visible {
  outline: 2px solid rgba(232, 196, 120, 0.85);
  outline-offset: 2px;
}

.player__frame img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  pointer-events: none;
}

.player__frame--sat img {
  image-rendering: pixelated;
}

.player__frame--hd img {
  image-rendering: auto;
}

.player__frame--hd .player__shot {
  border-color: rgba(232, 196, 120, 0.55);
}

.player__frame figcaption {
  font-size: 0.68rem;
  line-height: 1.35;
  letter-spacing: 0.02em;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
}

@container blink (max-height: 640px) {
  .player__bands {
    margin-top: 0.3rem;
  }

  .player__controls {
    margin-top: 0.35rem;
  }
}

@container blink (max-width: 420px) {
  .player__duo {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
