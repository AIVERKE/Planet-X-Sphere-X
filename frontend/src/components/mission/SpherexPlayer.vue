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
}>()

const frames = ref<SpherexFrame[]>([])
const availableBands = ref<string[]>([])
const band = ref<string | null>(null)
const matched = ref(0)
const phase = ref<'idle' | 'meta' | 'images' | 'ready' | 'error'>('idle')
const loadedImages = ref(0)
const skipped = ref(0)
const errorMessage = ref('')
let loadToken = 0

const frameCount = computed(() => frames.value.length)
const { index, playing, msPerFrame, play, toggle, select, next, prev, reset } =
  useFramePlayer(frameCount)
const active = computed(() => frames.value[index.value] ?? null)
const progress = computed(() => {
  if (!frames.value.length) return 0
  return Math.round((loadedImages.value / frames.value.length) * 100)
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

/** Precarga todos los PNG; devuelve qué índices cargaron bien (un fallo no tumba el resto). */
async function preload(urls: string[], token: number): Promise<boolean[]> {
  loadedImages.value = 0
  if (!urls.length) return []
  const results = await Promise.allSettled(
    urls.map(async (src) => {
      try {
        await preloadOne(src)
      } finally {
        if (token === loadToken) loadedImages.value += 1
      }
    }),
  )
  return results.map((r) => r.status === 'fulfilled')
}

async function load() {
  const token = ++loadToken
  reset()
  frames.value = []
  skipped.value = 0
  phase.value = 'meta'
  errorMessage.value = ''
  loadedImages.value = 0

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
    const urls = result.frames.map((frame) => apiUrl(frame.png_url))
    const ok = await preload(urls, token)
    if (token !== loadToken) return
    const usable = result.frames.filter((_, i) => ok[i])
    skipped.value = result.frames.length - usable.length
    if (!usable.length) throw new Error('No se pudo cargar ningún cuadro PNG')
    frames.value = usable
    phase.value = 'ready'
    if (usable.length >= 2) play()
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

watch(
  () => [props.ra, props.dec, props.radius, props.cutoutSize] as const,
  () => {
    band.value = null
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <div class="player">
    <p class="player__lead">
      Cutouts SPHEREx de este punto, en orden de tiempo. El navegador solo recibe PNG.
    </p>

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

    <p v-if="phase === 'meta'" class="player__meta">Preparando cuadros SPHEREx…</p>
    <div v-else-if="phase === 'images'" class="player__progress">
      <p class="player__meta">Cargando imágenes {{ loadedImages }} / {{ frames.length }}</p>
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
        <span>{{ index + 1 }} / {{ frames.length }}<template v-if="matched > frames.length"> · {{ matched }} épocas</template><template v-if="skipped"> · {{ skipped }} sin cargar</template></span>
      </label>

      <figure class="player__frame">
        <img :src="apiUrl(active.png_url)" :alt="`SPHEREx ${active.band} ${active.obs_id}`" />
        <figcaption>{{ overlay }}</figcaption>
      </figure>
    </template>
  </div>
</template>

<style scoped>
.player__lead,
.player__meta {
  margin: 0.75rem 0 0;
  font-size: 0.95rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.78);
}

.player__bands {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.3rem;
  margin-top: 0.75rem;
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
  gap: 0.45rem;
  margin: 0.85rem 0 0.4rem;
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
  margin: 0.35rem 0 0.75rem;
}

.player__slider input[type='range'] {
  flex: 1;
}

.player__frame {
  margin: 0;
  display: grid;
  justify-items: center;
  gap: 0.4rem;
}

.player__frame img {
  width: min(100%, 280px);
  aspect-ratio: 1;
  object-fit: contain;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.25);
  image-rendering: pixelated;
}

.player__frame figcaption {
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-align: center;
  color: rgba(255, 255, 255, 0.72);
}
</style>
