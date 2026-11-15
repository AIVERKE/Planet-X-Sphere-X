<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiUrl } from '@/services/http'
import {
  fetchSpherexFrames,
  nearBarnardOffline,
  type SpherexFrame,
} from '@/services/spherexFrames'
import { fetchUnwiseEpochStamps, type EpochStamp } from '@/services/unwiseEpochs'
import { panstarrsColorJpeg } from '@/services/panstarrs'
import { useFramePlayer } from '@/composables/useFramePlayer'
import { enhanceJpegToHd } from '@/utils/enhanceJpeg'
import { mjdToIso, shortObsId } from '@/utils/skyFormat'

const DETECTORS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const

type BlinkSource = 'spherex' | 'wise' | 'panstarrs'

type BlinkFrame = {
  id: string
  band: string
  caption: string
  leftSrc: string
  rightSrc: string
  leftTag: string
  rightTag: string
  rightCaption: string
}

const props = defineProps<{
  ra: number
  dec: number
  radius?: number
  cutoutSize?: number
  note?: string
  objectType?: string
}>()

const emit = defineEmits<{
  focusSky: [payload: { ra: number; dec: number; fovDeg: number }]
}>()

const source = ref<BlinkSource>('spherex')
/** Qué pidió el usuario en el switch (puede diferir del respaldo automático). */
const preferredSource = ref<'spherex' | 'wise'>('spherex')
/** true si WISE entró porque SPHEREx falló, no por elección. */
const wiseIsFallback = ref(false)
const frames = ref<BlinkFrame[]>([])
const availableBands = ref<string[]>([])
const band = ref<string | null>(null)
const matched = ref(0)
const phase = ref<'idle' | 'meta' | 'images' | 'ready' | 'error'>('idle')
const loadedImages = ref(0)
const hdReady = ref(0)
const skipped = ref(0)
const errorMessage = ref('')
const metaHint = ref('Consultando IRSA…')
const spherexError = ref('')
const reloading = ref(false)
/** Segundos en la espera SPHEREx (IRSA puede demorar). */
const waitSeconds = ref(0)
/**
 * Filtros de imagen (saturación + contraste) a mano del usuario.
 * Apagados por defecto: en campos brillantes (nebulosas) quemaban la foto en blanco.
 */
const filtersOn = ref(false)
/** Saturación del panel HD (100 = normal). */
const saturation = ref(125)
/** Contraste de las fotos del blink (100 = normal). */
const contrast = ref(110)
/** Zoom de las fotos del blink (100–280%). */
const imgZoom = ref(100)
/** Modal grande centrado: blink a pantalla completa. */
const enlargeOpen = ref(false)
/** Modal: qué es cada foto / diferencia SPHEREx vs WISE. */
const paceOpen = ref(false)
const hdBlobUrls = new Set<string>()
let loadToken = 0
let waitTimer: number | null = null

const frameCount = computed(() => frames.value.length)
const { index, playing, msPerFrame, play, toggle, select, next, prev, reset } =
  useFramePlayer(frameCount)
const active = computed(() => frames.value[index.value] ?? null)
const progress = computed(() => {
  if (!frames.value.length) return 0
  return Math.round((loadedImages.value / frames.value.length) * 100)
})

const kindLine = computed(() => {
  const kind = props.objectType || ''
  if (kind === 'variable_star') return 'Estrella variable: mira el brillo, no el sitio'
  if (kind === 'survey_region') return 'Campo infrarrojo: cada mancha es una fuente'
  if (kind) return 'Fuente puntual: cabe en una muestra de SPHEREx'
  return 'Cada mancha es una medida infrarroja'
})

const showWaitPanel = computed(
  () =>
    (phase.value === 'meta' || phase.value === 'images' || reloading.value) &&
    phase.value !== 'error' &&
    !active.value,
)

const waitExplain = computed(() => {
  const s = waitSeconds.value
  if (phase.value === 'images') {
    return `Ya hay lista de visitas. Bajando fotos del satélite (${loadedImages.value}/${Math.max(frames.value.length, 1)}).`
  }
  if (s < 8) {
    return 'Consultando el catálogo IRSA de SPHEREx. La primera respuesta suele tardar.'
  }
  if (s < 20) {
    return 'IRSA sigue ocupado. No está roto: a veces tarda 20–40 s en listar las visitas.'
  }
  return 'La espera va larga. Puedes seguir o pasar ya a WISE (movimiento entre épocas).'
})

const waitStepLabel = computed(() => {
  if (phase.value === 'images') return 'Paso 2/2 · bajando PNG'
  return 'Paso 1/2 · listando visitas en IRSA'
})

const scaleLine = computed(() => {
  if (source.value === 'panstarrs') return 'PanSTARRS · 1 foto óptica (no es blink)'
  if (source.value === 'wise') {
    return wiseIsFallback.value
      ? 'WISE · épocas time-resolved (respaldo)'
      : 'WISE · épocas time-resolved (WiseView)'
  }
  return 'SPHEREx · mira el cambio entre fechas'
})

const sourceBanner = computed(() => {
  if (source.value === 'spherex') {
    return {
      title: 'Viendo: SPHEREx',
      body: 'Fuente principal de la misión.',
      tone: 'ok' as const,
    }
  }
  if (source.value === 'wise') {
    if (wiseIsFallback.value) {
      const localHint = nearBarnardOffline(props.ra, props.dec)
        ? 'IRSA no respondió; si falla otra vez, prueba Barnard (tiene caché local).'
        : 'IRSA caído: SPHEREx offline solo tiene caché de Barnard. Aquí usamos WISE time-resolved (WiseView) para ver movimiento real.'
      return {
        title: 'Viendo: WISE (respaldo)',
        body: localHint,
        tone: 'warn' as const,
      }
    }
    return {
      title: 'Viendo: WISE',
      body: 'Épocas time-resolved (WiseView/unWISE): cada cuadro es otra ventana de años. Ahí se ve el movimiento propio. Aladin es DSS óptico; WISE es IR.',
      tone: 'ok' as const,
    }
  }
  return {
    title: 'Viendo: PanSTARRS (1 foto)',
    body: 'No es multi-época: WISE/SPHEREx no cargaron. Pulsa WISE para cargar épocas time-resolved con movimiento real.',
    tone: 'warn' as const,
  }
})

const imgZoomStyle = computed(() => ({
  transform: `scale(${imgZoom.value / 100})`,
  transformOrigin: 'center center',
}))

function isIrsaOutage(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('HTTP 503') ||
    msg.includes('Tiempo agotado') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('HTTP 502') ||
    msg.includes('HTTP 504')
  )
}

function classify(error: unknown): string {
  const msg = error instanceof Error ? error.message : ''
  if (msg.includes('HTTP 404')) {
    return 'No hay capturas SPHEREx en este punto.'
  }
  if (isIrsaOutage(error)) {
    return 'SPHEREx no responde ahora. Prueba otra vez en unos segundos.'
  }
  return 'No se pudo cargar SPHEREx ahora.'
}

function preloadOne(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No se pudo cargar un cuadro PNG'))
    image.src = src
  })
}

function toSpherexFrames(list: SpherexFrame[]): BlinkFrame[] {
  return list.map((frame) => ({
    id: frame.obs_id,
    band: frame.band,
    caption: `${mjdToIso(frame.t_min)} · MJD ${Number.isFinite(frame.t_min) ? frame.t_min.toFixed(2) : '—'} · ${frame.band} · ${shortObsId(frame.obs_id)}`,
    leftSrc: apiUrl(frame.png_url),
    rightSrc: apiUrl(frame.png_url_hd || frame.png_url),
    leftTag: 'SPHEREx · satélite',
    rightTag: 'HD fluido · misma fecha',
    rightCaption: 'Misma foto · más suave',
  }))
}

function toWiseFrames(stamps: EpochStamp[]): BlinkFrame[] {
  return stamps.map((stamp) => {
    const mjd =
      stamp.mjd != null && Number.isFinite(stamp.mjd) ? ` · MJD ${stamp.mjd.toFixed(1)}` : ''
    return {
      id: stamp.id,
      band: stamp.label,
      caption: `${stamp.label} · ${stamp.yearHint}${mjd}`,
      leftSrc: stamp.jpegUrl,
      // Se sustituye por blob HD en warmHd; mientras tanto el crudo.
      rightSrc: stamp.jpegUrl,
      leftTag: `WISE · satélite`,
      rightTag: 'HD fluido · misma fecha',
      rightCaption: 'Misma época · más suave',
    }
  })
}

function revokeHdBlobs() {
  if (!hdBlobUrls.size) return
  // load() puede dejar los cuadros viejos en pantalla mientras recarga: que su
  // panel HD vuelva al crudo antes de revocar, o el <img> pide un blob muerto
  // (net::ERR_FILE_NOT_FOUND) en cada cuadro del blink.
  if (frames.value.some((frame) => hdBlobUrls.has(frame.rightSrc))) {
    frames.value = frames.value.map((frame) =>
      hdBlobUrls.has(frame.rightSrc) ? { ...frame, rightSrc: frame.leftSrc } : frame,
    )
  }
  for (const url of hdBlobUrls) URL.revokeObjectURL(url)
  hdBlobUrls.clear()
}

function stopWaitTicker() {
  if (waitTimer != null) {
    window.clearInterval(waitTimer)
    waitTimer = null
  }
}

function startWaitTicker() {
  stopWaitTicker()
  waitSeconds.value = 0
  waitTimer = window.setInterval(() => {
    waitSeconds.value += 1
    if (phase.value === 'meta' && source.value === 'spherex') {
      const s = waitSeconds.value
      if (s === 8) {
        metaHint.value = 'IRSA sigue buscando visitas SPHEREx…'
      } else if (s === 20) {
        metaHint.value = 'Tarda más de lo normal · puedes usar WISE'
      }
    }
  }, 1000)
}

/** Cancela la espera SPHEREx y abre WISE al momento. */
async function useWiseNow(asFallback = true) {
  const token = ++loadToken
  stopWaitTicker()
  spherexError.value = asFallback
    ? 'Pasaste a WISE sin esperar a SPHEREx.'
    : ''
  errorMessage.value = ''
  frames.value = []
  // Los HD de la carga anterior ya no se muestran: liberarlos (antes se filtraban).
  revokeHdBlobs()
  availableBands.value = []
  band.value = null
  phase.value = 'meta'
  reloading.value = false
  source.value = 'wise'
  preferredSource.value = 'wise'
  wiseIsFallback.value = asFallback
  metaHint.value = asFallback ? 'Cargando WISE (sin esperar SPHEREx)…' : 'Cargando WISE…'
  startWaitTicker()
  try {
    await loadWiseWithRetry(token, asFallback)
    stopWaitTicker()
  } catch {
    if (token !== loadToken) return
    try {
      await loadPanstarrsFallback(token)
      stopWaitTicker()
    } catch {
      if (token !== loadToken) return
      stopWaitTicker()
      errorMessage.value = 'No se pudo cargar WISE time-resolved. Revisa el backend / WiseView.'
      phase.value = 'error'
      reloading.value = false
      source.value = 'spherex'
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Switch SPHEREx ↔ WISE a petición del usuario. */
function selectSource(next: 'spherex' | 'wise') {
  if (preferredSource.value === next && source.value === next && frames.value.length) return
  preferredSource.value = next
  if (next === 'wise') {
    void useWiseNow(false)
    return
  }
  void load(true)
}

function nudgeZoom(delta: number) {
  imgZoom.value = Math.min(280, Math.max(100, imgZoom.value + delta))
}

function onZoomWheel(event: WheelEvent) {
  nudgeZoom(event.deltaY > 0 ? -12 : 12)
}

function resetZoom() {
  imgZoom.value = 100
}

async function warmHd(frameList: BlinkFrame[], token: number) {
  hdReady.value = 0

  async function enhanceOne(frame: BlinkFrame) {
    if (token !== loadToken) return
    try {
      if (source.value === 'spherex') {
        await preloadOne(frame.rightSrc)
      } else {
        // WiseView ya es PNG “bonito”: hay que suavizar fuerte para notar izq vs der.
        const hd = await enhanceJpegToHd(frame.leftSrc, { scale: 3 })
        if (token !== loadToken) {
          URL.revokeObjectURL(hd)
          return
        }
        hdBlobUrls.add(hd)
        frame.rightSrc = hd
        if (token === loadToken) frames.value = [...frameList]
      }
      if (token === loadToken) hdReady.value += 1
    } catch (error) {
      console.warn('[blink HD]', error)
    }
  }

  // Primero la época visible; luego el resto (2 en paralelo).
  const order = [
    index.value,
    ...frameList.map((_, i) => i).filter((i) => i !== index.value),
  ]
  let cursor = 0
  const concurrency = source.value === 'spherex' ? 3 : 2
  const workers = Array.from({ length: concurrency }, async () => {
    while (token === loadToken) {
      const pos = cursor++
      if (pos >= order.length) return
      const i = order[pos]!
      const frame = frameList[i]
      if (frame) await enhanceOne(frame)
    }
  })
  await Promise.all(workers)
}

async function loadWiseFallback(token: number, asFallback = true) {
  metaHint.value = asFallback ? 'Cargando WISE time-resolved (WiseView)…' : 'Cargando WISE…'
  const stamps = await fetchUnwiseEpochStamps(props.ra, props.dec, 160)
  if (token !== loadToken) return
  const mapped = toWiseFrames(stamps)
  source.value = 'wise'
  preferredSource.value = 'wise'
  wiseIsFallback.value = asFallback
  saturation.value = 135
  contrast.value = 115
  imgZoom.value = 100
  availableBands.value = []
  matched.value = mapped.length
  frames.value = mapped
  skipped.value = 0
  loadedImages.value = mapped.length
  hdReady.value = 0
  phase.value = 'ready'
  reloading.value = false
  if (mapped.length >= 2) play()
  void warmHd(mapped, token)
}

/** WISE con un reintento: evita caer a PanSTARRS (1 foto) por un fallo puntual. */
async function loadWiseWithRetry(token: number, asFallback = true) {
  try {
    await loadWiseFallback(token, asFallback)
  } catch {
    if (token !== loadToken) return
    metaHint.value = 'Reintentando WISE time-resolved…'
    await sleep(500)
    if (token !== loadToken) return
    await loadWiseFallback(token, asFallback)
  }
}

async function loadPanstarrsFallback(token: number) {
  metaHint.value = 'Último recurso: PanSTARRS óptico (1 foto, sin épocas)…'
  const sizePx = Math.round(((props.cutoutSize ?? 0.08) * 3600) / 0.25)
  const url = await panstarrsColorJpeg(props.ra, props.dec, Math.min(900, Math.max(256, sizePx)))
  if (token !== loadToken) return
  await preloadOne(url)
  if (token !== loadToken) return
  source.value = 'panstarrs'
  saturation.value = 120
  availableBands.value = []
  matched.value = 1
  const mapped: BlinkFrame[] = [
    {
      id: 'panstarrs',
      band: 'yig',
      caption: 'PanSTARRS stack · 1 foto (no es WISE/SPHEREx)',
      leftSrc: url,
      rightSrc: url,
      leftTag: 'PanSTARRS · óptico',
      rightTag: 'Misma foto · más suave',
      rightCaption: 'No hay secuencia temporal aquí',
    },
  ]
  frames.value = mapped
  skipped.value = 0
  loadedImages.value = 1
  hdReady.value = 0
  phase.value = 'ready'
  reloading.value = false
  void warmHd(mapped, token)
}

async function loadSpherex(token: number) {
  source.value = 'spherex'
  preferredSource.value = 'spherex'
  wiseIsFallback.value = false
  saturation.value = 115
  contrast.value = 110
  imgZoom.value = 100
  spherexError.value = ''
  metaHint.value = `Listando visitas SPHEREx · AR ${props.ra.toFixed(3)}° · Dec ${props.dec.toFixed(3)}°`
  const result = await fetchSpherexFrames({
    ra: props.ra,
    dec: props.dec,
    radius: props.radius,
    cutoutSize: props.cutoutSize,
    band: band.value,
  })
  if (token !== loadToken) return
  availableBands.value = result.available_bands
  matched.value = result.matched
  band.value = result.band
  const mapped = toSpherexFrames(result.frames)
  if (!frames.value.length) {
    frames.value = mapped
    phase.value = 'images'
  }
  metaHint.value = `Bajando fotos · ${result.returned} visitas en este punto`
  let started = false
  const ok = await Promise.all(
    mapped.map(async (frame) => {
      try {
        await preloadOne(frame.leftSrc)
        if (token !== loadToken) return true
        loadedImages.value += 1
        if (!started) {
          started = true
          frames.value = mapped
          phase.value = 'ready'
          reloading.value = false
          if (mapped.length >= 2) play()
        }
        return true
      } catch {
        if (token === loadToken) loadedImages.value += 1
        return false
      }
    }),
  )
  if (token !== loadToken) return
  const usable = mapped.filter((_, i) => ok[i])
  skipped.value = mapped.length - usable.length
  if (!usable.length) throw new Error('No se pudo cargar ningún cuadro PNG')
  frames.value = usable
  source.value = 'spherex'
  phase.value = 'ready'
  reloading.value = false
  void warmHd(usable, token)
}

async function load(preferSpherex = true) {
  const token = ++loadToken
  const keepPlanes = frames.value.length > 0 && (phase.value === 'ready' || phase.value === 'images')
  reset()
  skipped.value = 0
  errorMessage.value = ''
  loadedImages.value = 0
  hdReady.value = 0
  revokeHdBlobs()
  if (keepPlanes) {
    reloading.value = true
  } else {
    reloading.value = false
    frames.value = []
    phase.value = 'meta'
  }
  startWaitTicker()

  if (preferSpherex) {
    try {
      await loadSpherex(token)
      if (token === loadToken) stopWaitTicker()
      return
    } catch (error) {
      if (token !== loadToken) return
      spherexError.value = classify(error)
      metaHint.value = 'SPHEREx no respondió a tiempo · pasando a WISE time-resolved…'
      try {
        await loadWiseWithRetry(token)
        if (token === loadToken) stopWaitTicker()
        return
      } catch {
        if (token !== loadToken) return
        try {
          await loadPanstarrsFallback(token)
          if (token === loadToken) stopWaitTicker()
          return
        } catch {
          if (token !== loadToken) return
          stopWaitTicker()
          errorMessage.value = spherexError.value
          phase.value = 'error'
          reloading.value = false
          frames.value = []
          source.value = 'spherex'
          return
        }
      }
    }
  }

  // Reintento forzado solo SPHEREx (botón).
  try {
    await loadSpherex(token)
    if (token === loadToken) stopWaitTicker()
  } catch (error) {
    if (token !== loadToken) return
    stopWaitTicker()
    errorMessage.value = classify(error)
    phase.value = 'error'
    reloading.value = false
  }
}

function retrySpherex() {
  preferredSource.value = 'spherex'
  void load(true)
}

function reloadPreferred() {
  if (preferredSource.value === 'wise') {
    void useWiseNow(false)
    return
  }
  void load(true)
}

function onSlide(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) select(value)
}

function selectBand(code: string) {
  if (source.value !== 'spherex') return
  if (phase.value === 'meta' || phase.value === 'images') return
  if (band.value === code && frames.value.length) return
  band.value = code
  void load(true)
}

function rightSrc(frame: BlinkFrame): string {
  // Solo usar HD cuando ya hay blob distinto del JPEG crudo.
  if (frame.rightSrc && frame.rightSrc !== frame.leftSrc) return frame.rightSrc
  return frame.leftSrc
}

/** Estilo vivo: saturación + contraste en ambas fotos, solo si el usuario los activa. */
const duoSatStyle = computed(() => ({
  '--blink-filter': filtersOn.value
    ? `saturate(${saturation.value}%) contrast(${contrast.value}%)`
    : 'none',
}))

function toggleFilters() {
  filtersOn.value = !filtersOn.value
}

const sourceSwitchDisabled = computed(
  () => phase.value === 'meta' || phase.value === 'images' || reloading.value,
)

/** Etiqueta corta del botón junto a ms. */
const paceButtonLabel = computed(() => {
  const n = frames.value.length
  if (source.value === 'spherex') return `${n} visitas · ¿qué es cada foto?`
  if (source.value === 'wise') return `${n} épocas WISE · ¿qué es cada foto?`
  return '¿Qué es cada foto?'
})

const paceNowLine = computed(() => {
  const n = frames.value.length
  const wait = msPerFrame.value
  if (source.value === 'spherex') {
    const bandLabel = band.value || active.value?.band || 'Dx'
    const archive =
      matched.value > n ? ` En el archivo IRSA hay ${matched.value} visitas; aquí cargamos ${n}.` : ''
    return `Ahora ves SPHEREx: ${n} fotos del detector ${bandLabel}, una por fecha de visita.${archive} El valor ms (${wait}) es la pausa entre visitas en el blink.`
  }
  if (source.value === 'wise') {
    const why = wiseIsFallback.value ? ' (respaldo porque SPHEREx no respondió)' : ' (lo elegiste en el switch)'
    return `Ahora ves WISE${why}: ${n} épocas time-resolved (WiseView). Cada foto es otra ventana temporal — el objeto que se mueve es real, no un coadd acumulativo. El valor ms (${wait}) es la pausa del blink.`
  }
  return 'Ahora ves una foto fija del campo (sin secuencia temporal).'
})

/** Textos didácticos de cada control (valen igual en SPHEREx y WISE). */
const controlGuide = computed(() => {
  const spherex = source.value === 'spherex'
  const n = frames.value.length
  return {
    epochs: spherex
      ? 'Épocas / visitas: cada paso es una foto SPHEREx de otra fecha (misma banda D1–D6). Mueve el slider o usa Anterior/Siguiente para comparar.'
      : 'Épocas WISE time-resolved: cada paso es otra ventana temporal (WiseView). En objetivos de Movimiento deberías ver el salto de posición.',
    ms: `Intervalo del blink (${msPerFrame.value} ms): velocidad de la animación al dar Play. No elige la época: solo cuánto espera entre un cuadro y el siguiente (como en WiseView).`,
    epochsPick: spherex
      ? 'Esto elige qué visita SPHEREx estás viendo (1, 2, 3…). No es la velocidad del blink.'
      : `Esto elige qué época WISE estás viendo (1 de ${n || 8}…). No es la velocidad del blink.`,
    filters:
      'Filtros: apagados, ves la foto tal cual llega. Actívalos para usar Saturación y Contraste; desactívalos para volver a la original.',
    saturation:
      'Saturación: intensidad del color. Más bajo = más gris; más alto = naranjas/rojos IR más vivos. Sirve igual en SPHEREx y WISE.',
    contrast:
      'Contraste: diferencia entre zonas claras y oscuras. Súbelo si la estrella se pierde en el ruido; bájalo si el centro se quema en blanco.',
    zoom: 'Zoom: acerca el recorte para ver el desplazamiento. En SPHEREx mira el núcleo; en WISE el salto entre épocas.',
    duo: 'Izquierda = foto del satélite (cruda). Derecha = la misma fecha, más suave (HD). Las dos cambian juntas al pasar de época.',
  }
})

const showControlHelp = ref(false)

function openPaceInfo() {
  if (playing.value) toggle()
  paceOpen.value = true
}

function closePaceInfo() {
  paceOpen.value = false
}

function openEnlarge() {
  if (!active.value) return
  paceOpen.value = false
  showControlHelp.value = false
  enlargeOpen.value = true
  // En grande se ve la foto completa; el zoom lo sube el usuario.
  if (imgZoom.value > 100) imgZoom.value = 100
}

function closeEnlarge() {
  enlargeOpen.value = false
}

function onPaceKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (enlargeOpen.value) {
    event.preventDefault()
    closeEnlarge()
    return
  }
  if (paceOpen.value) {
    event.preventDefault()
    closePaceInfo()
  }
}

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
    reloadPreferred()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', onPaceKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onPaceKey)
  stopWaitTicker()
  revokeHdBlobs()
})
</script>

<template>
  <div class="player" :class="`player--${source}`">
    <p class="player__lead">{{ kindLine }} · {{ scaleLine }}</p>
    <p v-if="note" class="player__note">{{ note }}</p>
    <p class="player__coords" title="Mismas coordenadas que el rectángulo del atlas">
      Fotos en AR {{ ra.toFixed(5) }}° · Dec {{ dec >= 0 ? '+' : '' }}{{ dec.toFixed(5) }}°
    </p>

    <div class="player__switch" role="tablist" aria-label="Fuente del blink">
      <button
        type="button"
        class="player__switch-btn"
        role="tab"
        :aria-selected="preferredSource === 'spherex'"
        :class="{ 'is-on': preferredSource === 'spherex' }"
        :disabled="sourceSwitchDisabled"
        @click="selectSource('spherex')"
      >
        SPHEREx
      </button>
      <button
        type="button"
        class="player__switch-btn"
        role="tab"
        :aria-selected="preferredSource === 'wise'"
        :class="{ 'is-on': preferredSource === 'wise' }"
        :disabled="sourceSwitchDisabled"
        @click="selectSource('wise')"
      >
        WISE
      </button>
    </div>

    <aside class="player__source" :class="`is-${sourceBanner.tone}`" aria-live="polite">
      <div class="player__source-text">
        <strong>{{ sourceBanner.title }}</strong>
        <p>{{ sourceBanner.body }}</p>
      </div>
      <button
        v-if="source !== 'spherex' && preferredSource === 'spherex'"
        type="button"
        class="player__go player__source-btn"
        @click="retrySpherex"
      >
        Probar SPHEREx
      </button>
    </aside>

    <div v-if="source === 'spherex'" class="player__bands" role="group" aria-label="Detector">
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

    <div v-if="showWaitPanel" class="player__wait" aria-live="polite">
      <p class="player__wait-step">{{ waitStepLabel }}</p>
      <p class="player__wait-title">{{ metaHint }}</p>
      <p class="player__wait-body">{{ waitExplain }}</p>
      <div
        v-if="phase === 'images'"
        class="player__bar"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${progress}%` }" />
      </div>
      <p class="player__wait-clock">{{ waitSeconds }} s en espera</p>
      <div class="player__wait-actions">
        <button
          v-if="source === 'spherex' || reloading"
          type="button"
          class="player__go"
          @click="() => useWiseNow(true)"
        >
          Usar WISE ahora
        </button>
        <button type="button" class="player__step" @click="retrySpherex">Reintentar SPHEREx</button>
      </div>
      <p class="player__wait-note">
        Si IRSA no contesta, el blink pasa a WISE time-resolved (WiseView): cada época es otra
        ventana temporal real, con MJD propio.
      </p>
    </div>
    <div v-else-if="phase === 'error'" class="player__err">
      <p>{{ errorMessage }}</p>
      <div class="player__wait-actions">
        <button type="button" class="player__go" @click="retrySpherex">Probar SPHEREx</button>
        <button type="button" class="player__step" @click="() => useWiseNow(true)">Usar WISE</button>
      </div>
    </div>
    <p v-else-if="reloading && active" class="player__meta">{{ metaHint }}</p>

    <template v-if="active && phase !== 'error'">
      <div class="player__zoom player__zoom--top" aria-label="Zoom de las fotos">
        <span>Zoom</span>
        <button type="button" class="player__zoom-btn" title="Alejar" @click="nudgeZoom(-20)">−</button>
        <input
          v-model.number="imgZoom"
          type="range"
          min="100"
          max="280"
          step="10"
          :aria-valuenow="imgZoom"
        />
        <button type="button" class="player__zoom-btn" title="Acercar" @click="nudgeZoom(20)">+</button>
        <em>{{ imgZoom }}%</em>
        <button
          v-if="imgZoom !== 100"
          type="button"
          class="player__zoom-reset"
          @click="resetZoom"
        >
          1×
        </button>
      </div>

      <div
        class="player__duo"
        :style="duoSatStyle"
        aria-label="Satélite a la izquierda, HD fluido a la derecha. Clic para ampliar."
        role="button"
        tabindex="0"
        @click="openEnlarge"
        @keydown.enter.prevent="openEnlarge"
      >
        <figure class="player__frame player__frame--sat">
          <span class="player__tag">{{ active.leftTag }}</span>
          <div class="player__shot">
            <img :key="active.id" :src="active.leftSrc" :alt="active.leftTag" :style="imgZoomStyle" />
          </div>
          <figcaption>{{ active.caption }}</figcaption>
        </figure>
        <figure class="player__frame player__frame--hd">
          <span class="player__tag">{{ active.rightTag }}</span>
          <div class="player__shot">
            <img :key="`${active.id}-hd`" :src="rightSrc(active)" :alt="active.rightTag" :style="imgZoomStyle" />
          </div>
          <figcaption>
            <template v-if="hdReady < frames.length">
              HD {{ hdReady }}/{{ frames.length }}
              <template v-if="active.rightSrc === active.leftSrc"> · suavizando…</template>
            </template>
            <template v-else>{{ active.rightCaption }}</template>
          </figcaption>
        </figure>
      </div>

      <div class="player__enlarge-row">
        <button type="button" class="player__go player__enlarge-btn" @click.stop="openEnlarge">
          Ver en grande
        </button>
      </div>

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
        <button
          type="button"
          class="player__step"
          title="Centrar el atlas Aladin en este campo"
          @click="focusOnSky"
        >
          Atlas
        </button>
        <button
          type="button"
          class="player__pace-btn"
          aria-haspopup="dialog"
          :aria-expanded="paceOpen"
          @click="openPaceInfo"
        >
          {{ paceButtonLabel }}
        </button>
      </div>

      <label class="player__frame-pick" :title="controlGuide.epochsPick">
        <span class="player__frame-pick-label">
          {{ source === 'spherex' ? 'Visita' : 'Época' }}
          {{ index + 1 }} de {{ frames.length }}
        </span>
        <input
          type="range"
          min="0"
          :max="Math.max(frames.length - 1, 0)"
          step="1"
          :value="index"
          :disabled="frames.length < 2"
          list="blink-epoch-ticks"
          @input="onSlide"
        />
        <datalist id="blink-epoch-ticks">
          <option v-for="(_, i) in frames" :key="`tick-${i}`" :value="i" />
        </datalist>
      </label>

      <div class="player__blink-ms" :title="controlGuide.ms">
        <span>Intervalo del blink</span>
        <div class="player__blink-ms-row">
          <input
            v-model.number="msPerFrame"
            type="range"
            min="200"
            max="4000"
            step="20"
            aria-label="Intervalo del blink en milisegundos"
          />
          <label class="player__blink-ms-num">
            <input
              v-model.number="msPerFrame"
              type="number"
              min="200"
              max="4000"
              step="50"
            />
            ms
          </label>
        </div>
      </div>

      <div class="player__tune" :class="{ 'is-off': !filtersOn }">
        <button
          type="button"
          class="player__filters"
          :class="{ 'is-on': filtersOn }"
          :aria-pressed="filtersOn"
          :title="controlGuide.filters"
          @click="toggleFilters"
        >
          Filtros: {{ filtersOn ? 'activados' : 'desactivados' }}
        </button>

        <label class="player__sat" :title="controlGuide.saturation">
          <span>Saturación</span>
          <input
            v-model.number="saturation"
            type="range"
            min="40"
            max="220"
            step="5"
            :disabled="!filtersOn"
            :aria-valuenow="saturation"
          />
          <em>{{ saturation }}%</em>
        </label>

        <label class="player__sat" :title="controlGuide.contrast">
          <span>Contraste</span>
          <input
            v-model.number="contrast"
            type="range"
            min="70"
            max="180"
            step="5"
            :disabled="!filtersOn"
            :aria-valuenow="contrast"
          />
          <em>{{ contrast }}%</em>
        </label>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="enlargeOpen && active"
        class="enlarge-modal"
        role="presentation"
        @click.self="closeEnlarge"
      >
        <div
          class="enlarge-modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enlarge-modal-title"
          :style="duoSatStyle"
        >
          <header class="enlarge-modal__bar">
            <div>
              <p class="enlarge-modal__kicker">Blink en grande</p>
              <h2 id="enlarge-modal-title">
                {{ source === 'wise' ? 'WISE' : source === 'panstarrs' ? 'Campo' : 'SPHEREx' }}
                · {{ index + 1 }}/{{ frames.length }}
              </h2>
            </div>
            <button type="button" class="enlarge-modal__close" @click="closeEnlarge">Cerrar</button>
          </header>

          <div class="enlarge-modal__zoom" aria-label="Zoom de las fotos">
            <span>Zoom</span>
            <button type="button" class="player__zoom-btn" title="Alejar" @click="nudgeZoom(-20)">−</button>
            <input
              v-model.number="imgZoom"
              type="range"
              min="100"
              max="320"
              step="10"
              :aria-valuenow="imgZoom"
            />
            <button type="button" class="player__zoom-btn" title="Acercar" @click="nudgeZoom(20)">+</button>
            <em>{{ imgZoom }}%</em>
            <button
              v-if="imgZoom !== 100"
              type="button"
              class="player__zoom-reset"
              @click="resetZoom"
            >
              1×
            </button>
          </div>

          <div class="enlarge-modal__duo" @wheel.prevent="onZoomWheel">
            <figure class="enlarge-modal__frame">
              <span>{{ active.leftTag }}</span>
              <div class="enlarge-modal__shot">
                <img :key="active.id" :src="active.leftSrc" :alt="active.leftTag" :style="imgZoomStyle" />
              </div>
              <figcaption>{{ active.caption }}</figcaption>
            </figure>
            <figure class="enlarge-modal__frame enlarge-modal__frame--hd">
              <span>{{ active.rightTag }}</span>
              <div class="enlarge-modal__shot">
                <img :key="`${active.id}-hd`" :src="rightSrc(active)" :alt="active.rightTag" :style="imgZoomStyle" />
              </div>
              <figcaption>{{ active.rightCaption }}</figcaption>
            </figure>
          </div>

          <div class="enlarge-modal__footer">
            <div class="enlarge-modal__tools">
              <button type="button" class="player__go" :disabled="frames.length < 2" @click="toggle()">
                {{ playing ? 'Pausa' : 'Play' }}
              </button>
              <button type="button" class="player__step" :disabled="!frames.length" @click="prev()">
                Anterior
              </button>
              <button type="button" class="player__step" :disabled="!frames.length" @click="next()">
                Siguiente
              </button>
              <button
                type="button"
                class="player__step"
                :aria-pressed="showControlHelp"
                @click="showControlHelp = !showControlHelp"
              >
                {{ showControlHelp ? 'Ocultar guía' : 'Cómo funciona' }}
              </button>
            </div>

            <div v-if="source === 'spherex'" class="enlarge-modal__bands" role="group" aria-label="Detector SPHEREx">
              <button
                v-for="code in DETECTORS"
                :key="`en-${code}`"
                type="button"
                class="player__band"
                :class="{
                  'is-on': band === code,
                  'is-off': availableBands.length > 0 && !availableBands.includes(code),
                }"
                :disabled="sourceSwitchDisabled"
                @click="selectBand(code)"
              >
                {{ code }}
              </button>
            </div>

            <label class="enlarge-modal__frame-pick">
              <span>
                {{ source === 'spherex' ? 'Visita' : 'Época' }}
                {{ index + 1 }} de {{ frames.length }}
              </span>
              <input
                type="range"
                min="0"
                :max="Math.max(frames.length - 1, 0)"
                step="1"
                :value="index"
                :disabled="frames.length < 2"
                @input="onSlide"
              />
            </label>
            <p v-if="showControlHelp" class="enlarge-modal__tip">{{ controlGuide.epochsPick }}</p>

            <div class="enlarge-modal__blink-ms">
              <span>Intervalo del blink</span>
              <div class="enlarge-modal__blink-ms-row">
                <input
                  v-model.number="msPerFrame"
                  type="range"
                  min="200"
                  max="4000"
                  step="20"
                  aria-label="Intervalo del blink en milisegundos"
                />
                <label class="enlarge-modal__blink-ms-num">
                  <input
                    v-model.number="msPerFrame"
                    type="number"
                    min="200"
                    max="4000"
                    step="50"
                  />
                  ms
                </label>
              </div>
            </div>
            <p v-if="showControlHelp" class="enlarge-modal__tip">{{ controlGuide.ms }}</p>

            <button
              type="button"
              class="player__filters"
              :class="{ 'is-on': filtersOn }"
              :aria-pressed="filtersOn"
              :title="controlGuide.filters"
              @click="toggleFilters"
            >
              Filtros: {{ filtersOn ? 'activados' : 'desactivados' }}
            </button>
            <p v-if="showControlHelp" class="enlarge-modal__tip">{{ controlGuide.filters }}</p>

            <label class="enlarge-modal__slider" :class="{ 'is-off': !filtersOn }">
              <span>Saturación</span>
              <input
                v-model.number="saturation"
                type="range"
                min="40"
                max="220"
                step="5"
                :disabled="!filtersOn"
              />
              <em>{{ saturation }}%</em>
            </label>
            <p v-if="showControlHelp" class="enlarge-modal__tip">{{ controlGuide.saturation }}</p>

            <label class="enlarge-modal__slider" :class="{ 'is-off': !filtersOn }">
              <span>Contraste</span>
              <input
                v-model.number="contrast"
                type="range"
                min="70"
                max="180"
                step="5"
                :disabled="!filtersOn"
              />
              <em>{{ contrast }}%</em>
            </label>
            <p v-if="showControlHelp" class="enlarge-modal__tip">{{ controlGuide.contrast }}</p>
            <p v-if="showControlHelp" class="enlarge-modal__tip">{{ controlGuide.zoom }}</p>
            <p v-if="showControlHelp" class="enlarge-modal__tip enlarge-modal__tip--duo">
              {{ controlGuide.duo }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="paceOpen"
        class="pace-modal"
        role="presentation"
        @click.self="closePaceInfo"
      >
        <div
          class="pace-modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pace-modal-title"
        >
          <header class="pace-modal__bar">
            <div>
              <p class="pace-modal__kicker">Blink · fotos y fechas</p>
              <h2 id="pace-modal-title">Qué estás viendo en cada cuadro</h2>
            </div>
            <button type="button" class="pace-modal__close" @click="closePaceInfo">
              Cerrar
            </button>
          </header>

          <div class="pace-modal__scroll">
            <p class="pace-modal__now" :class="`is-${source}`">{{ paceNowLine }}</p>

            <section class="pace-modal__card" :class="{ 'is-active': source === 'spherex' }">
              <h3>SPHEREx (misión principal)</h3>
              <ul>
                <li>Cada cuadro es <strong>una visita real</strong>: una fecha (MJD) y un detector (D1–D6).</li>
                <li>En un mismo punto del cielo puede haber <strong>decenas de visitas</strong> en el archivo; el blink carga un subconjunto usable (a menudo ~12).</li>
                <li>Izquierda = PNG del satélite; derecha = la <strong>misma fecha</strong> en HD fluido.</li>
                <li>Sirve para ver cambios entre pasadas SPHEREx, no entre años WISE.</li>
              </ul>
            </section>

            <section class="pace-modal__card" :class="{ 'is-active': source === 'wise' }">
              <h3>WISE / unWISE (WiseView)</h3>
              <ul>
                <li>Cada cuadro es una <strong>época time-resolved</strong> (ventana temporal estrecha), no un coadd NEO acumulativo.</li>
                <li>En objetivos de <strong>Movimiento</strong> (WISE 0855, Barnard…) el blink muestra el salto real entre años.</li>
                <li>Misma fuente que <strong>byw.tools/wiseview</strong>; se usa también cuando SPHEREx/IRSA no responde.</li>
                <li>Izquierda = PNG WiseView; derecha = la misma época suavizada en HD.</li>
              </ul>
            </section>

            <section class="pace-modal__card">
              <h3>Época / visita ≠ intervalo del blink</h3>
              <ul>
                <li><strong>Época o visita</strong> elige <em>qué</em> foto miras (1 de N, 2 de N…).</li>
                <li><strong>Intervalo del blink</strong> (como en WiseView) elige <em>qué tan rápido</em> cambia al dar Play, en milisegundos.</li>
                <li>No uses el slider de épocas para la velocidad: para eso está “Intervalo del blink (ms)”.</li>
              </ul>
            </section>

            <section class="pace-modal__card">
              <h3>Controles de imagen (SPHEREx y WISE)</h3>
              <ul>
                <li><strong>Filtros:</strong> {{ controlGuide.filters }}</li>
                <li><strong>Saturación:</strong> {{ controlGuide.saturation }}</li>
                <li><strong>Contraste:</strong> {{ controlGuide.contrast }}</li>
                <li><strong>Zoom / Ver en grande:</strong> {{ controlGuide.zoom }}</li>
                <li><strong>Las dos fotos:</strong> {{ controlGuide.duo }}</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Teleport>
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
.player__note,
.player__coords {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
}

.player__note {
  margin-top: 0.2rem;
  color: #ffe9b8;
}

.player__coords {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: #9ecbff;
  font-variant-numeric: tabular-nums;
}

.player__switch {
  margin-top: 0.45rem;
  display: inline-flex;
  flex: none;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.35);
}

.player__switch-btn {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  padding: 0.4rem 0.75rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 0.35rem;
  cursor: pointer;
}

.player__switch-btn.is-on {
  background: rgba(232, 196, 120, 0.22);
  color: #ffe9b8;
}

.player__switch-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.player__source {
  margin-top: 0.45rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(232, 196, 120, 0.35);
  border-radius: 0.45rem;
  background: rgba(232, 196, 120, 0.08);
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.7rem;
  min-width: 0;
}

.player__source.is-warn {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(251, 191, 36, 0.1);
}

.player__source-text {
  flex: 1 1 10rem;
  min-width: 0;
}

.player__source strong {
  display: block;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffe9b8;
}

.player__source p {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.82);
}

.player__source-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

@container blink (max-width: 420px) {
  .player__source {
    flex-direction: column;
    align-items: stretch;
  }

  .player__source-btn {
    width: 100%;
  }
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

.player__wait {
  flex: 1 1 auto;
  min-height: 10rem;
  margin: 0.55rem 0 0;
  padding: 0.85rem 0.9rem;
  border: 1px solid rgba(232, 196, 120, 0.35);
  border-radius: 0.55rem;
  background:
    radial-gradient(ellipse at 30% 0%, rgba(232, 196, 120, 0.12), transparent 55%),
    rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  justify-content: center;
}

.player__wait-step {
  margin: 0;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.75);
}

.player__wait-title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 650;
  color: #fff;
  line-height: 1.35;
}

.player__wait-body {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.8);
}

.player__wait-clock {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: #ffe9b8;
}

.player__wait-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.player__wait-note {
  margin: 0.15rem 0 0;
  font-size: 0.74rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.55);
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

.player__err-hint {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.82rem;
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

.player__frame-pick,
.player__blink-ms {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0.25rem 0 0.15rem;
  flex: none;
  min-width: 0;
}

.player__frame-pick-label,
.player__blink-ms > span {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.88);
}

.player__blink-ms > span {
  color: #9ecbff;
}

.player__blink-ms-row,
.enlarge-modal__blink-ms-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.player__frame-pick input[type='range'],
.player__blink-ms-row input[type='range'],
.enlarge-modal__blink-ms-row input[type='range'] {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  accent-color: #e8c478;
}

.player__frame-pick input[type='range'] {
  accent-color: #c4b5a0;
}

.player__blink-ms-num,
.enlarge-modal__blink-ms-num {
  display: flex;
  align-items: center;
  gap: 0.28rem;
  flex: 0 0 auto;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.75);
}

.player__blink-ms-num input,
.enlarge-modal__blink-ms-num input {
  width: 4.2rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 0.35rem;
}

.player__pace-btn {
  border: 1px solid rgba(232, 196, 120, 0.55);
  background: rgba(232, 196, 120, 0.12);
  color: #ffe9b8;
  padding: 0.4rem 0.65rem;
  font-size: 0.75rem;
  line-height: 1.2;
  letter-spacing: 0.02em;
  cursor: pointer;
  max-width: 100%;
}

.player__pace-btn:hover {
  background: rgba(232, 196, 120, 0.22);
}

.pace-modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.62);
}

.pace-modal__panel {
  width: min(32rem, 100%);
  max-height: min(88vh, 40rem);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(232, 196, 120, 0.5);
  border-radius: 0.75rem;
  background: rgba(8, 10, 16, 0.98);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.pace-modal__bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex: none;
}

.pace-modal__kicker {
  margin: 0 0 0.2rem;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.75);
}

.pace-modal__bar h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: #fff;
}

.pace-modal__close {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  padding: 0.4rem 0.65rem;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  flex: none;
}

.pace-modal__scroll {
  overflow: auto;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  -webkit-overflow-scrolling: touch;
}

.pace-modal__now {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(232, 196, 120, 0.35);
  background: rgba(232, 196, 120, 0.1);
  color: #ffe9b8;
  font-size: 0.9rem;
  line-height: 1.45;
}

.pace-modal__now.is-wise,
.pace-modal__now.is-panstarrs {
  border-color: rgba(255, 180, 100, 0.4);
  background: rgba(255, 160, 80, 0.1);
}

.pace-modal__card {
  margin: 0;
  padding: 0.7rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.03);
}

.pace-modal__card.is-active {
  border-color: rgba(232, 196, 120, 0.55);
  background: rgba(232, 196, 120, 0.07);
}

.pace-modal__card h3 {
  margin: 0 0 0.4rem;
  font-size: 0.92rem;
  color: #ffe9b8;
}

.pace-modal__card ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.86rem;
  line-height: 1.45;
}

.pace-modal__card strong {
  color: #fff;
  font-weight: 650;
}

.player__slider {
  margin: 0.3rem 0 0.35rem;
  flex: none;
}

.player__sat,
.player__zoom {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.45rem;
  flex: none;
  min-width: 0;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.72);
}

.player__sat span,
.player__zoom span {
  flex: 0 0 auto;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 0.68rem;
  color: #ffe9b8;
}

.player__sat input[type='range'],
.player__zoom input[type='range'] {
  flex: 1 1 auto;
  min-width: 0;
  accent-color: #e8c478;
}

.player__sat em,
.player__zoom em {
  flex: 0 0 2.6rem;
  font-style: normal;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.player__zoom-btn {
  flex: 0 0 auto;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid rgba(232, 196, 120, 0.45);
  background: rgba(232, 196, 120, 0.1);
  color: #ffe9b8;
  border-radius: 0.3rem;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.player__zoom-reset {
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  padding: 0.2rem 0.4rem;
  font-size: 0.7rem;
  border-radius: 0.3rem;
  cursor: pointer;
}

.player__hint {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.58);
  flex: none;
}

.player__enlarge-row {
  display: flex;
  justify-content: center;
  margin: 0.35rem 0 0.45rem;
  flex: none;
}

.player__enlarge-btn {
  padding: 0.5rem 1.1rem;
  font-size: 0.78rem;
}

.enlarge-modal {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: grid;
  place-items: center;
  padding: 0.45rem;
  background: rgba(0, 0, 0, 0.82);
}

.enlarge-modal__panel {
  width: min(96rem, 100%);
  height: min(96vh, 100%);
  max-height: 98vh;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(232, 196, 120, 0.5);
  border-radius: 0.75rem;
  background: rgba(5, 7, 12, 0.98);
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.65);
  overflow: hidden;
}

.enlarge-modal__bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex: none;
}

.enlarge-modal__zoom,
.player__zoom--top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: none;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.74rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #ffe9b8;
}

.player__zoom--top {
  padding: 0.35rem 0;
  margin-top: 0.35rem;
  border-bottom: 0;
}

.enlarge-modal__zoom input[type='range'],
.player__zoom--top input[type='range'] {
  flex: 1 1 auto;
  min-width: 0;
  accent-color: #e8c478;
}

.enlarge-modal__zoom em,
.player__zoom--top em {
  flex: 0 0 2.6rem;
  font-style: normal;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
}

.enlarge-modal__kicker {
  margin: 0 0 0.15rem;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.75);
}

.enlarge-modal__bar h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 650;
  color: #fff;
}

.enlarge-modal__close {
  border: 1px solid rgba(232, 196, 120, 0.55);
  background: rgba(232, 196, 120, 0.14);
  color: #ffe9b8;
  padding: 0.45rem 0.7rem;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  flex: none;
}

.enlarge-modal__duo {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.65rem;
  padding: 0.45rem 0.75rem 0.35rem;
  align-items: stretch;
}

.enlarge-modal__footer {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem 0.65rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.28);
  max-height: 30%;
  overflow: auto;
}

.enlarge-modal__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.enlarge-modal__bands {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
}

.enlarge-modal__frame-pick,
.enlarge-modal__blink-ms,
.enlarge-modal__slider {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.88);
}

.enlarge-modal__blink-ms > span {
  color: #9ecbff;
}

.enlarge-modal__slider {
  flex-direction: row;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.74rem;
  color: rgba(255, 233, 184, 0.88);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.enlarge-modal__slider span {
  flex: 0 0 5.5rem;
}

.enlarge-modal__frame-pick input[type='range'],
.enlarge-modal__slider input[type='range'] {
  width: 100%;
  min-width: 0;
  accent-color: #e8c478;
}

.enlarge-modal__frame-pick input[type='range'] {
  accent-color: #c4b5a0;
}

.enlarge-modal__slider input {
  flex: 1 1 auto;
}

.enlarge-modal__slider em {
  flex: 0 0 3.2rem;
  font-style: normal;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.8);
}

.enlarge-modal__tip {
  margin: -0.05rem 0 0.3rem;
  font-size: 0.72rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.62);
  text-transform: none;
  letter-spacing: 0;
}

.enlarge-modal__tip--duo {
  margin-left: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(232, 196, 120, 0.28);
  border-radius: 0.4rem;
  background: rgba(232, 196, 120, 0.07);
  color: rgba(255, 233, 184, 0.88);
}

.enlarge-modal__frame {
  margin: 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0.25rem;
}

.enlarge-modal__frame span {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #ffe9b8;
  text-align: center;
}

.enlarge-modal__shot {
  position: relative;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.enlarge-modal__frame--hd .enlarge-modal__shot {
  border-color: rgba(232, 196, 120, 0.55);
}

.enlarge-modal__shot img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
  transition: transform 0.12s ease-out;
  /* Sin filtro salvo que el usuario active "Filtros" (--blink-filter en el panel). */
  filter: var(--blink-filter, none);
}

.enlarge-modal__frame figcaption {
  margin: 0;
  font-size: 0.72rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.3;
}

@media (max-width: 720px) {
  .enlarge-modal__duo {
    grid-template-columns: minmax(0, 1fr);
  }

  .enlarge-modal__panel {
    height: min(96vh, 100%);
  }
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
  min-height: min(42vh, 22rem);
  margin-top: 0.45rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 0.55rem;
  align-items: stretch;
  cursor: zoom-in;
}

.player__duo:focus-visible {
  outline: 1px solid rgba(232, 196, 120, 0.7);
  outline-offset: 2px;
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
  gap: 0.22rem;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 12rem;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: #000;
  overflow: hidden;
}

.player__frame img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  object-position: center;
  background: #000;
  pointer-events: none;
  transition: transform 0.12s ease-out;
  will-change: transform;
  /* Sin filtro salvo que el usuario active "Filtros" (--blink-filter en .player__duo). */
  filter: var(--blink-filter, none);
}

.player__tune {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.2rem;
  flex: none;
}

.player__filters {
  align-self: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  padding: 0.35rem 0.6rem;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 0.3rem;
  cursor: pointer;
}

.player__filters.is-on {
  border-color: rgba(232, 196, 120, 0.7);
  background: rgba(232, 196, 120, 0.16);
  color: #ffe9b8;
}

.player__tune.is-off .player__sat,
.enlarge-modal__slider.is-off {
  opacity: 0.45;
}

.player__frame--sat img {
  /* Foto del satélite tal cual: sin pixelar ni filtrar de más. */
  image-rendering: auto;
}

.player--panstarrs .player__frame--sat img {
  image-rendering: auto;
}

.player__frame--hd img {
  /* Render del sistema: color intacto, sin blur extra (el canvas ya lo afila). */
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
