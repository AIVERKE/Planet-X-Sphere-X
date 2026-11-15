<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import {
  LOCAL_HIPS,
  applyLocalHips,
  loadAladinLite,
  patchAladinNetwork,
  refreshAladinView,
  setAladinFoV,
  type AladinInstance,
  type AladinAPI,
  type LocalHipsId,
} from '@/services/loadAladinLite'
import {
  checkBackendHealth,
  fetchObservations,
  type ObservationsResponse,
} from '@/services/http'
import SpherexPlayer from '@/components/mission/SpherexPlayer.vue'
import { useFramePlayer } from '@/composables/useFramePlayer'
import {
  fetchPanstarrsStamps,
  panstarrsPortalUrl,
} from '@/services/panstarrs'
import {
  fetchUnwiseEpochStamps,
  wiseviewPortalUrl,
} from '@/services/unwiseEpochs'
import { PRESET_FALLBACK, SPHEREX_EPOCH, presetById } from '@/data/presetFallback'
import { getPresets } from '@/services/presets'
import type { PresetLocation } from '@/types/presets'
import {
  bandLabel,
  formatRaDec,
  hostFromUrl,
  isValidDec,
  isValidRa,
  mjdToHint,
  parseCoord,
  shortObsId,
} from '@/utils/skyFormat'
import {
  FOV_MAX,
  FOV_MIN,
  describeInvalidQuery,
  readFromQuery,
  useSkyUrlState,
  type SkyUrlState,
  type SkyViewState,
} from '@/composables/useSkyUrlState'
import '@/styles/explorer.css'

type ViewStage = 'idle' | 'flying' | 'hd'
type SideTab = 'info' | 'stamps'
type MotionMode = 'spherex' | 'wise'
type StampMode = 'epochs' | 'bands'
type StampFrame = {
  id: string
  label: string
  jpegUrl: string
  sub?: string
}

type StartView = { ra: number; dec: number; fov: number; target: PresetLocation | null }
type CopyFeedback = { which: 'link' | 'embed'; ok: boolean }

/** Desplazamiento mínimo (grados) a partir del cual una vista llegada por URL recarga datos. */
const RELOAD_DISTANCE_DEG = 1 / 60
const CUTOUT_SIZE_DEG = 0.08
/** Radio del cono SIA (arcsec) para buscar imágenes que contengan el objetivo. */
const OBS_RADIUS_ARCSEC = 90

const router = useRouter()
const route = useRoute()
const { writeToQuery, commitToQuery, flushQueryWrite, cancelQueryWrite, isOwnQuery } =
  useSkyUrlState()
const host = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')
const aladinRef = shallowRef<AladinInstance | null>(null)

const raInput = ref('83.8221')
const decInput = ref('-5.3911')
const fovInput = ref(2.5)
const liveRa = ref('—')
const liveDec = ref('—')

const SURVEYS = (Object.keys(LOCAL_HIPS) as LocalHipsId[]).map((id) => ({
  id,
  label: LOCAL_HIPS[id].label,
  url: LOCAL_HIPS[id].url,
}))

const surveyId = ref<LocalHipsId>('esa-dss')
const aladinApi = shallowRef<AladinAPI | null>(null)
const skyHint = ref('Preparando atlas…')
const backendOk = ref<boolean | null>(null)
const obsLoading = ref(false)
const obsError = ref<string | null>(null)
const obsResult = ref<ObservationsResponse | null>(null)
const presets = ref<PresetLocation[]>(PRESET_FALLBACK)
const presetsFromApi = ref(false)
const activeTarget = ref<PresetLocation | null>(
  resolveStartView(readFromQuery(route.query).state).target,
)
const officialPresets = computed(() => presets.value.filter((p) => p.category === 'official_test'))
const surveyPresets = computed(() => presets.value.filter((p) => p.category === 'survey_field'))
const stage = ref<ViewStage>('idle')
const stageHint = ref('Elige una nebulosa · el cielo es el protagonista')

const catalogOpen = ref(true)
const drawerOpen = ref(true)
const sideTab = ref<SideTab>('info')
const searchOpen = ref(false)
const searchError = ref<string | null>(null)

const stamps = ref<StampFrame[]>([])
const stampMode = ref<StampMode>('epochs')
const stampLoading = ref(false)
const stampError = ref<string | null>(null)
const stampRa = ref<number | null>(null)
const stampDec = ref<number | null>(null)
const stampsKey = ref('')
const motionMode = ref<MotionMode>('spherex')
const motionRadius = ref(90)
const {
  index: blinkIndex,
  playing: blinkOn,
  msPerFrame: blinkMs,
  play: startBlink,
  stop: stopBlink,
  toggle: toggleBlink,
  select: selectStamp,
} = useFramePlayer(computed(() => stamps.value.length))

const isEmbed = computed(() => readFromQuery(route.query).state.embed)
const urlNotice = ref<string | null>(null)
const shareOpen = ref(false)
const copyFeedback = ref<CopyFeedback | null>(null)
const shareLinkField = ref<HTMLInputElement | null>(null)
const embedCodeField = ref<HTMLTextAreaElement | null>(null)

let coordTimer: ReturnType<typeof setInterval> | null = null
let noticeTimer: ReturnType<typeof setTimeout> | null = null
let copyTimer: ReturnType<typeof setTimeout> | null = null
let journeyToken = 0
let stampLoadToken = 0
/** true mientras se aplica una vista llegada por URL: no se re-escribe la URL. */
let syncingFromUrl = false

const obsPreview = computed(() => (obsResult.value?.observations ?? []).slice(0, 5))
const activeStamp = computed(() => stamps.value[blinkIndex.value] ?? stamps.value[0] ?? null)
const ps1Portal = computed(() => {
  if (stampRa.value == null || stampDec.value == null) return ''
  return panstarrsPortalUrl(stampRa.value, stampDec.value, 240)
})
const wisePortal = computed(() => {
  if (stampRa.value == null || stampDec.value == null) return ''
  return wiseviewPortalUrl(stampRa.value, stampDec.value)
})

const stageLabel = computed(() =>
  stage.value === 'flying' ? 'Viajando' : stage.value === 'hd' ? 'HD' : 'Listo',
)

const zoomSlider = computed({
  get() {
    const fov = Math.min(FOV_MAX, Math.max(FOV_MIN, Number(fovInput.value) || 2))
    const t = Math.log(fov / FOV_MIN) / Math.log(FOV_MAX / FOV_MIN)
    return Math.round(t * 1000)
  },
  set(raw: number) {
    const t = Math.min(1000, Math.max(0, raw)) / 1000
    const fov = FOV_MIN * (FOV_MAX / FOV_MIN) ** t
    fovInput.value = Number(fov.toFixed(fov < 1 ? 3 : 2))
    applyFoVLive()
  },
})

const zoomLabel = computed(() => {
  const f = Number(fovInput.value) || 2
  if (f < 0.15) return `${(f * 3600).toFixed(0)}″`
  if (f < 1.2) return `${(f * 60).toFixed(0)}′`
  return `${f.toFixed(1)}°`
})

function absoluteHref(query: LocationQueryRaw): string {
  return new URL(router.resolve({ name: 'mission', query }).href, window.location.origin).href
}

/** URL de la vista actual (la misma que copia "Copiar enlace"). */
const shareUrl = computed(() =>
  new URL(router.resolve(route.fullPath).href, window.location.origin).href,
)

/** Vista actual en la app completa (sin `embed`), para "Abrir en Planet-X". */
const fullAppUrl = computed(() => {
  const query: LocationQueryRaw = { ...route.query }
  delete query.embed
  return absoluteHref(query)
})

const embedCode = computed(() => {
  const src = absoluteHref({ ...route.query, embed: '1' })
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
  return `<iframe src="${src}" width="800" height="500" style="border:0" loading="lazy" allow="clipboard-write" title="Planet-X · Atlas SPHEREx"></iframe>`
})

function roundFov(fov: number): number {
  return Number(fov.toFixed(fov < 1 ? 3 : 2))
}

/** Preset por id o alias: primero el catálogo del API, luego el fallback local. */
function presetLookup(id: string | null | undefined): PresetLocation | null {
  return presetById(id, presets.value) ?? presetById(id) ?? null
}

/** FOV del atlas para un preset (DSS no baja bien de ~0.35°). */
function presetFov(preset: PresetLocation | null): number {
  if (!preset) return 0.55
  return Math.min(FOV_MAX, Math.max(FOV_MIN, Math.max(preset.fov_deg, 0.35)))
}

/**
 * Vista inicial según la URL, por prioridad:
 * a) `ra` + `dec`; b) preset de `target`; c) objetivo por defecto.
 */
function resolveStartView(state: SkyUrlState): StartView {
  const preset = presetLookup(state.target)
  if (state.ra != null && state.dec != null) {
    return { ra: state.ra, dec: state.dec, fov: state.fov ?? presetFov(preset), target: preset }
  }
  if (preset) {
    return { ra: preset.ra, dec: preset.dec, fov: state.fov ?? presetFov(preset), target: preset }
  }
  const first = presetLookup('barnard') ?? presets.value[0] ?? null
  if (first) {
    return { ra: first.ra, dec: first.dec, fov: state.fov ?? presetFov(first), target: first }
  }
  return {
    ra: Number(raInput.value),
    dec: Number(decInput.value),
    fov: state.fov ?? 1.8,
    target: null,
  }
}

function showUrlNotice(message: string | null) {
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = null
  urlNotice.value = message
  if (message) {
    noticeTimer = setTimeout(() => {
      urlNotice.value = null
      noticeTimer = null
    }, 6000)
  }
}

/** Distancia angular aproximada en grados (suficiente para umbrales de ~1′). */
function angularDistanceDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const dRa = ((((ra2 - ra1) % 360) + 540) % 360) - 180
  const cosDec = Math.cos((((dec1 + dec2) / 2) * Math.PI) / 180)
  return Math.hypot(dRa * cosDec, dec2 - dec1)
}

/** Vista actual del atlas para escribirla en la URL (o null si aún no hay coords). */
function currentView(): SkyViewState | null {
  const ra = Number(liveRa.value)
  const dec = Number(liveDec.value)
  const fov = Number(fovInput.value)
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(fov)) return null
  return { ra, dec, fov, target: activeTarget.value?.id ?? null }
}

async function waitForHostSize(el: HTMLElement, tries = 20): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const rect = el.getBoundingClientRect()
    if (rect.width >= 64 && rect.height >= 64) return true
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }
  return false
}

async function boot() {
  if (!host.value) return
  status.value = 'loading'
  errorMessage.value = ''
  skyHint.value = 'Preparando atlas…'
  patchAladinNetwork()

  try {
    await nextTick()
    if (!host.value) return
    await waitForHostSize(host.value)

    const A = await loadAladinLite()
    aladinApi.value = A
    if (!host.value) return

    host.value.innerHTML = ''
    surveyId.value = 'esa-dss'
    const hipsUrl = LOCAL_HIPS['esa-dss'].url
    const parsed = readFromQuery(route.query)
    const start = resolveStartView(parsed.state)
    const target = `${start.ra} ${start.dec}`
    const startFov = start.fov

    raInput.value = start.ra.toFixed(6)
    decInput.value = start.dec.toFixed(6)
    fovInput.value = roundFov(startFov)
    showUrlNotice(describeInvalidQuery(parsed))

    // Comprobar que el proxy HiPS responde antes de pintar.
    skyHint.value = 'Comprobando tiles…'
    const probe = await fetch(`${hipsUrl}/properties`, { cache: 'no-store' })
    if (!probe.ok) {
      throw new Error(`Proxy HiPS no responde (${probe.status}). Reinicia npm run dev.`)
    }

    const aladin = A.aladin(host.value, {
      survey: hipsUrl,
      target,
      fov: startFov,
      projection: 'SIN',
      cooFrame: 'ICRSd',
      showReticle: true,
      reticleSize: 18,
      showFrame: false,
      showCooGrid: false,
      showGotoControl: false,
      showFullscreenControl: false,
      showLayersControl: false,
      showProjectionControl: false,
      showSimbadPointerControl: false,
      showShareControl: false,
      showCatalog: false,
      showZoomControl: false,
      showStatusBar: false,
      showFov: false,
      showCooLocation: false,
      fullScreen: false,
      realFullscreen: false,
      backgroundColor: 'rgb(0,0,0)',
    })

    applyLocalHips(A, aladin, 'esa-dss')
    refreshAladinView(aladin, host.value)

    window.setTimeout(() => {
      try {
        applyLocalHips(A, aladin, surveyId.value)
        aladin.gotoRaDec(start.ra, start.dec)
        setAladinFoV(aladin, startFov)
        refreshAladinView(aladin, host.value)
        skyHint.value = 'Atlas listo · rueda para zoom'
      } catch {
        skyHint.value = 'Atlas inestable · prueba Survey en Buscar'
      }
    }, 400)

    aladinRef.value = aladin
    status.value = 'ready'
    stage.value = 'hd'
    activeTarget.value = start.target
    stageHint.value =
      start.target?.name ?? `Apuntando AR ${start.ra.toFixed(5)}° · Dec ${start.dec.toFixed(5)}°`
    syncCoords()
    startCoordWatch()
    void pingBackend()
    void loadPresetCatalog()
    stampRa.value = start.ra
    stampDec.value = start.dec
    // En modo embed no hay panel de datos: solo hacen falta los sellos del reproductor.
    if (!isEmbed.value) {
      void loadObservationsAt(start.ra, start.dec, OBS_RADIUS_ARCSEC)
    }
    if (isEmbed.value || motionMode.value === 'wise') void loadStampsAt(start.ra, start.dec)
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error ? error.message : 'No se pudo cargar Aladin Lite'
    skyHint.value = 'Error al cargar el cielo'
  }
}

function startCoordWatch() {
  stopCoordWatch()
  coordTimer = setInterval(() => {
    syncCoords()
    syncFoVFromAladin()
  }, 400)
}

function stopCoordWatch() {
  if (coordTimer) {
    clearInterval(coordTimer)
    coordTimer = null
  }
}

function syncCoords() {
  const aladin = aladinRef.value
  if (!aladin) return
  try {
    const [ra, dec] = aladin.getRaDec()
    liveRa.value = Number(ra).toFixed(5)
    liveDec.value = Number(dec).toFixed(5)
  } catch {
    /* ignore */
  }
}

function syncFoVFromAladin() {
  const aladin = aladinRef.value
  if (!aladin || stage.value === 'flying') return
  try {
    const fov = aladin.getFov?.()?.[0]
    if (typeof fov !== 'number' || !Number.isFinite(fov)) return
    // La rueda de Aladin puede pasar del mínimo y dejar el DSS pixeleado.
    if (fov < FOV_MIN) {
      setAladinFoV(aladin, FOV_MIN)
      fovInput.value = FOV_MIN
      skyHint.value = 'Límite del atlas DSS · el detalle fino está en Movimiento'
      return
    }
    const rounded = roundFov(fov)
    const current = Number(fovInput.value)
    // Umbral relativo (1 %): con FOV pequeños un 0.01° fijo ocultaba el zoom de la URL.
    const threshold = Math.max(0.001, Math.abs(current) * 0.01)
    if (!Number.isFinite(current) || Math.abs(rounded - current) > threshold) {
      fovInput.value = rounded
    }
  } catch {
    /* ignore */
  }
}

function applyFoVLive() {
  const aladin = aladinRef.value
  if (!aladin) return
  setAladinFoV(aladin, Math.min(FOV_MAX, Math.max(FOV_MIN, Number(fovInput.value) || 2)))
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** Anima el FOV; se interrumpe si empieza otro viaje (nuevo destino, Atrás/Adelante…). */
async function animateFoV(from: number, to: number, ms = 1100, token = journeyToken) {
  const aladin = aladinRef.value
  if (!aladin) return
  const target = Math.min(FOV_MAX, Math.max(FOV_MIN, to))
  const start = Math.min(FOV_MAX, Math.max(FOV_MIN, from))
  const steps = 22
  const dt = ms / steps
  for (let i = 1; i <= steps; i++) {
    if (token !== journeyToken) return
    const t = i / steps
    const eased = 1 - (1 - t) ** 3
    const fov = start + (target - start) * eased
    setAladinFoV(aladin, fov)
    fovInput.value = Number(fov.toFixed(fov < 1 ? 3 : 2))
    await sleep(dt)
  }
  if (token !== journeyToken) return
  setAladinFoV(aladin, to)
  fovInput.value = Number(to.toFixed(to < 1 ? 3 : 2))
}

const playerRa = computed(() => stampRa.value ?? parseCoord(raInput.value, 'ra'))
const playerDec = computed(() => stampDec.value ?? parseCoord(decInput.value, 'dec'))

function goToCoords() {
  const aladin = aladinRef.value
  if (!aladin) {
    searchError.value = 'El atlas aún no está listo'
    return
  }

  const ra = parseCoord(raInput.value, 'ra')
  const dec = parseCoord(decInput.value, 'dec')
  if (ra == null || dec == null) {
    searchError.value =
      'Coords inválidas. Usa grados (268.33975 / 3.58428) o sexagesimal (17h53m21.5s / +03d35m03s)'
    return
  }
  if (!isValidRa(ra)) {
    searchError.value = 'AR debe estar entre 0 y 360° (o 0h y 24h)'
    return
  }
  if (!isValidDec(dec)) {
    searchError.value = 'Dec debe estar entre -90 y 90'
    return
  }

  searchError.value = null
  raInput.value = ra.toFixed(6)
  decInput.value = dec.toFixed(6)

  // FOV útil para ver el campo (si está muy abierto parece “cualquier cielo”).
  if (!Number.isFinite(Number(fovInput.value)) || Number(fovInput.value) > 2) {
    fovInput.value = 0.55
  }

  aladin.gotoRaDec(ra, dec)
  applyFoVLive()
  refreshAladinView(aladin, host.value)
  syncCoords()
  stage.value = 'hd'
  stageHint.value = `Apuntando AR ${ra.toFixed(5)}° · Dec ${dec.toFixed(5)}°`
  skyHint.value = 'Centrado · cargando datos del punto…'
  drawerOpen.value = true
  sideTab.value = 'info'
  void Promise.all([loadObservationsAt(ra, dec, 90), loadStampsAt(ra, dec)]).then(() => {
    skyHint.value = 'Punto listo · revisa Datos / Sellos'
  })
}

function applySurvey() {
  const aladin = aladinRef.value
  const A = aladinApi.value
  if (!aladin || !A) return
  try {
    applyLocalHips(A, aladin, surveyId.value)
    refreshAladinView(aladin, host.value)
  } catch {
    /* ignore */
  }
}

function zoomBy(factor: number) {
  const next = Math.min(FOV_MAX, Math.max(FOV_MIN, (Number(fovInput.value) || 2) * factor))
  fovInput.value = Number(next.toFixed(next < 1 ? 3 : 2))
  applyFoVLive()
  stage.value = 'hd'
}

async function pingBackend() {
  try {
    const health = await checkBackendHealth()
    backendOk.value = health.status === 'ok'
  } catch {
    backendOk.value = false
  }
}

async function loadObservationsAt(ra: number, dec: number, radius = 90) {
  obsLoading.value = true
  obsError.value = null
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      obsResult.value = await fetchObservations({
        ra,
        dec,
        radius,
        collection: 'spherex_dr1',
        cutout_size: CUTOUT_SIZE_DEG,
      })
      obsLoading.value = false
      return
    } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(900 * attempt)
    }
  }
  obsError.value =
    lastError instanceof Error
      ? `${lastError.message} · IRSA a veces satura; reintenta.`
      : 'No se pudieron cargar observaciones'
  obsResult.value = null
  obsLoading.value = false
}

async function loadObservations() {
  const ra =
    parseCoord(liveRa.value === '—' ? raInput.value : liveRa.value, 'ra') ??
    parseCoord(raInput.value, 'ra')
  const dec =
    parseCoord(liveDec.value === '—' ? decInput.value : liveDec.value, 'dec') ??
    parseCoord(decInput.value, 'dec')
  if (ra == null || dec == null) {
    searchError.value = 'No hay coordenadas válidas para consultar'
    searchOpen.value = true
    return
  }
  drawerOpen.value = true
  sideTab.value = 'info'
  motionRadius.value = OBS_RADIUS_ARCSEC
  stampRa.value = ra
  stampDec.value = dec
  const jobs: Promise<unknown>[] = [loadObservationsAt(ra, dec, OBS_RADIUS_ARCSEC)]
  if (motionMode.value === 'wise') jobs.push(loadStampsAt(ra, dec))
  await Promise.all(jobs)
}

async function loadStampsAt(ra: number, dec: number, mode: StampMode = stampMode.value) {
  const token = ++stampLoadToken
  stopBlink()
  stampLoading.value = true
  stampError.value = null
  stampRa.value = ra
  stampDec.value = dec
  stampMode.value = mode
  blinkIndex.value = 0
  stamps.value = []
  stampsKey.value = ''

  try {
    if (mode === 'epochs') {
      const epochs = await fetchUnwiseEpochStamps(ra, dec, 280)
      if (token !== stampLoadToken) return
      stamps.value = epochs.map((e) => ({
        id: e.id,
        label: e.label,
        jpegUrl: e.jpegUrl,
        sub: e.yearHint,
      }))
      stampsKey.value = `${ra},${dec},${mode}`
      stampLoading.value = false
      startBlink()
      return
    }

    const bands = await fetchPanstarrsStamps(ra, dec, 240)
    if (token !== stampLoadToken) return
    stamps.value = bands.map((b) => ({
      id: b.id,
      label: b.label,
      jpegUrl: b.jpegUrl,
      sub: 'PS1',
    }))
    stampsKey.value = `${ra},${dec},${mode}`
  } catch (error) {
    if (token !== stampLoadToken) return
    stamps.value = []
    stampError.value =
      error instanceof Error
        ? error.message
        : mode === 'epochs'
          ? 'No se pudieron cargar épocas unWISE'
          : 'No se pudieron cargar sellos PanSTARRS'
  } finally {
    if (token === stampLoadToken) stampLoading.value = false
  }
}

function showSpherex() {
  motionMode.value = 'spherex'
  stopBlink()
}

async function showWiseCompare() {
  motionMode.value = 'wise'
  const ra = stampRa.value
  const dec = stampDec.value
  if (ra == null || dec == null) return
  const key = `${ra},${dec},${stampMode.value}`
  if (stampsKey.value === key && stamps.value.length) return
  await loadStampsAt(ra, dec, stampMode.value)
}

async function setStampMode(mode: StampMode) {
  if (stampRa.value == null || stampDec.value == null) {
    stampMode.value = mode
    return
  }
  if (mode === stampMode.value && stamps.value.length) return
  await loadStampsAt(stampRa.value, stampDec.value, mode)
}

function openStampsTab() {
  drawerOpen.value = true
  sideTab.value = 'stamps'
  motionMode.value = 'spherex'
  stopBlink()
}

function presetCue(preset: PresetLocation): string {
  if (preset.object_type === 'variable_star') return 'Brillo'
  if (preset.category === 'official_test') return 'Movimiento'
  return 'Campo'
}

async function loadPresetCatalog() {
  try {
    const data = await getPresets({ epoch: SPHEREX_EPOCH })
    if (!data.length) return
    presets.value = data
    presetsFromApi.value = true
    const current = activeTarget.value
    const fresh = data.find((p) => p.id === current?.id)
    if (!fresh) return
    // Si la URL trae ra/dec manda la URL: solo se refrescan los datos del preset.
    const fromUrl = readFromQuery(route.query).state
    const urlHasCoords = fromUrl.ra != null && fromUrl.dec != null
    if (journeyToken === 0 && !urlHasCoords) {
      await visitPreset(fresh, { fromUrl: true, fov: fromUrl.fov ?? undefined })
    } else {
      activeTarget.value = fresh
    }
  } catch {
    presets.value = PRESET_FALLBACK
    presetsFromApi.value = false
  }
}

async function visitPreset(
  target: PresetLocation,
  { fromUrl = false, fov }: { fromUrl?: boolean; fov?: number } = {},
) {
  const aladin = aladinRef.value
  if (!aladin || status.value !== 'ready') return

  const token = ++journeyToken
  const fovHd = fov ?? Math.max(target.fov_deg, 0.35)
  if (fromUrl) {
    cancelQueryWrite()
  } else {
    // Elegir un destino es una acción discreta: entrada nueva en el historial (Atrás vuelve).
    void commitToQuery({ ra: target.ra, dec: target.dec, fov: fovHd, target: target.id }, 'push')
  }
  activeTarget.value = target
  obsError.value = null
  raInput.value = target.ra.toFixed(6)
  decInput.value = target.dec.toFixed(6)
  drawerOpen.value = true
  sideTab.value = target.category === 'official_test' ? 'stamps' : 'info'

  stage.value = 'flying'
  stageHint.value = target.name
  stampRa.value = target.ra
  stampDec.value = target.dec
  motionRadius.value = OBS_RADIUS_ARCSEC

  surveyId.value = 'esa-dss'
  applySurvey()
  // Atlas: FOV cómodo para DSS. El “zoom extremo” es Sellos, no el cielo de fondo.
  const atlasFov = Math.min(FOV_MAX, Math.max(FOV_MIN, fovHd))
  const wide = Math.min(6, Math.max(atlasFov * 4, atlasFov + 0.4))
  aladin.gotoRaDec(target.ra, target.dec)
  setAladinFoV(aladin, wide)
  fovInput.value = wide
  syncCoords()

  await sleep(350)
  if (token !== journeyToken) return

  await animateFoV(wide, atlasFov, 900, token)
  if (token !== journeyToken) return

  stage.value = 'hd'
  skyHint.value = target.highlight
  const jobs: Promise<unknown>[] = []
  if (!isEmbed.value) jobs.push(loadObservationsAt(target.ra, target.dec, OBS_RADIUS_ARCSEC))
  if (isEmbed.value || motionMode.value === 'wise') {
    jobs.push(loadStampsAt(target.ra, target.dec, 'epochs'))
  }
  await Promise.all(jobs)
}

/**
 * Aplica una vista llegada por URL con la página abierta (Atrás/Adelante, navegación
 * interna) moviendo el atlas existente, sin reiniciar Aladin.
 */
async function applyQueryToAtlas(query: LocationQuery) {
  const aladin = aladinRef.value
  if (!aladin) return

  const parsed = readFromQuery(query)
  showUrlNotice(describeInvalidQuery(parsed, { live: true }))
  const { ra, dec, fov, target } = parsed.state
  const preset = presetLookup(target)

  if (ra == null || dec == null) {
    if (preset && preset.id !== activeTarget.value?.id) {
      await visitPreset(preset, { fromUrl: true, fov: fov ?? undefined })
    } else if (fov != null) {
      syncingFromUrl = true
      cancelQueryWrite()
      fovInput.value = roundFov(fov)
      applyFoVLive()
      await nextTick()
      syncingFromUrl = false
    }
    return
  }

  syncingFromUrl = true
  cancelQueryWrite()
  journeyToken += 1 // corta una animación de visitPreset en curso
  try {
    const prevTargetId = activeTarget.value?.id ?? null
    const prevRa = Number(liveRa.value)
    const prevDec = Number(liveDec.value)

    activeTarget.value = preset
    raInput.value = ra.toFixed(6)
    decInput.value = dec.toFixed(6)
    aladin.gotoRaDec(ra, dec)
    if (fov != null) {
      fovInput.value = roundFov(fov)
      setAladinFoV(aladin, fov)
    }
    stage.value = 'hd'
    stageHint.value = preset?.name ?? `Apuntando AR ${ra.toFixed(5)}° · Dec ${dec.toFixed(5)}°`
    syncCoords()
    syncFoVFromAladin()

    const moved =
      !Number.isFinite(prevRa) ||
      !Number.isFinite(prevDec) ||
      angularDistanceDeg(prevRa, prevDec, ra, dec) > RELOAD_DISTANCE_DEG
    if (moved || (preset?.id ?? null) !== prevTargetId) {
      stampRa.value = ra
      stampDec.value = dec
      if (!isEmbed.value) void loadObservationsAt(ra, dec, OBS_RADIUS_ARCSEC)
      if (isEmbed.value || motionMode.value === 'wise') void loadStampsAt(ra, dec)
    }
    // Deja que corran los watchers de escritura mientras el flag sigue activo.
    await nextTick()
  } finally {
    syncingFromUrl = false
  }
}

// Atlas → URL: posición, FOV y objetivo (replace con debounce, sin historial).
watch(
  [liveRa, liveDec, fovInput, () => activeTarget.value?.id ?? null, stage],
  () => {
    if (syncingFromUrl || status.value !== 'ready' || stage.value === 'flying') return
    const view = currentView()
    if (view) writeToQuery(view)
  },
)

// URL → atlas: cambios de query con la página abierta (ignora las escrituras propias).
watch(
  () => route.query,
  (query) => {
    if (route.name !== 'mission' || status.value !== 'ready' || isOwnQuery(query)) return
    void applyQueryToAtlas(query)
  },
)

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) shareOpen.value = false
}

function toggleShare() {
  shareOpen.value = !shareOpen.value
  if (shareOpen.value) searchOpen.value = false
}

async function copyText(
  text: string,
  field: HTMLInputElement | HTMLTextAreaElement | null,
): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* sin permiso (iframe, http): probamos el método clásico */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (ok) return true
  } catch {
    /* ignore */
  }
  // Último recurso: dejar el texto seleccionado para Ctrl+C.
  field?.focus()
  field?.select()
  return false
}

function flashCopy(which: CopyFeedback['which'], ok: boolean) {
  if (copyTimer) clearTimeout(copyTimer)
  copyFeedback.value = { which, ok }
  copyTimer = setTimeout(() => {
    copyFeedback.value = null
    copyTimer = null
  }, 2000)
}

function copyLabel(which: CopyFeedback['which'], idle: string): string {
  const feedback = copyFeedback.value
  if (feedback?.which !== which) return idle
  return feedback.ok ? '¡Copiado!' : 'Copia con Ctrl+C'
}

async function copyLink() {
  // Que la URL refleje la vista exacta antes de copiarla.
  await flushQueryWrite()
  flashCopy('link', await copyText(window.location.href, shareLinkField.value))
}

async function copyEmbed() {
  await flushQueryWrite()
  flashCopy('embed', await copyText(embedCode.value, embedCodeField.value))
}

function selectField(event: Event) {
  const el = event.target
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select()
}

function useObsTarget(obs: Record<string, unknown>) {
  const ra = Number(obs.s_ra ?? obs.ra)
  const dec = Number(obs.s_dec ?? obs.dec)
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return
  raInput.value = ra.toFixed(6)
  decInput.value = dec.toFixed(6)
  fovInput.value = 0.7
  goToCoords()
  stageHint.value = shortObsId(obs.obs_id)
  stampRa.value = ra
  stampDec.value = dec
  if (motionMode.value === 'wise') void loadStampsAt(ra, dec)
}

function openExternal(url: unknown) {
  if (typeof url !== 'string' || !url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function goBack() {
  void router.push({ name: 'explorer' })
}

function openIn3d() {
  const t = activeTarget.value
  void router.push({
    name: 'explorer',
    query: t
      ? { sky: t.id, ra: String(t.ra), dec: String(t.dec) }
      : { ra: raInput.value, dec: decInput.value },
  })
}

onMounted(() => {
  document.documentElement.classList.add('is-explorer')
  document.documentElement.classList.remove('is-look-locked')
  void boot()
})

onUnmounted(() => {
  journeyToken += 1
  stopCoordWatch()
  stopBlink()
  if (noticeTimer) clearTimeout(noticeTimer)
  if (copyTimer) clearTimeout(copyTimer)
  try {
    aladinRef.value?.remove?.()
  } catch {
    /* ignore */
  }
  aladinRef.value = null
  if (host.value) host.value.innerHTML = ''
  document.documentElement.classList.remove('is-explorer')
})
</script>

<template>
  <div class="sky" :class="{ 'sky--embed': isEmbed }">
    <div ref="host" class="sky__canvas" aria-label="Atlas Aladin Lite" />

    <!-- HUD: una sola franja superior, sin FABs sueltos que choquen -->
    <header v-if="!isEmbed" class="sky__top">
      <div class="sky__brand" :class="{ 'is-pushed': catalogOpen }">
        <p class="sky__kicker">Atlas SPHEREx · {{ stageLabel }}</p>
        <h1 class="sky__title">{{ activeTarget?.name || 'Cielo HD' }}</h1>
        <p v-if="!catalogOpen" class="sky__skyhint">{{ skyHint }}</p>
      </div>
      <div class="sky__actions">
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': catalogOpen }"
          @click="catalogOpen = !catalogOpen"
        >
          Objetivos
        </button>
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': drawerOpen }"
          @click="drawerOpen = !drawerOpen"
        >
          Datos
        </button>
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': searchOpen }"
          @click="toggleSearch"
        >
          Buscar
        </button>
        <button type="button" class="btn" @click="openStampsTab">Sellos</button>
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': shareOpen }"
          @click="toggleShare"
        >
          Compartir
        </button>
        <button type="button" class="btn btn--gold" @click="openIn3d">3D</button>
        <button type="button" class="btn btn--ghost" @click="goBack">Salir</button>
      </div>
    </header>

    <div v-if="urlNotice" class="sky__notice" role="status">
      <span>{{ urlNotice }}</span>
      <button type="button" class="panel__x" aria-label="Cerrar aviso" @click="showUrlNotice(null)">
        ×
      </button>
    </div>

    <div v-if="status === 'ready' && searchOpen && !isEmbed" class="sky__search">
      <label>
        AR
        <input
          v-model="raInput"
          autocomplete="off"
          spellcheck="false"
          placeholder="268.33975 · 17h53m21.5s"
          @keydown.enter.prevent="goToCoords"
        />
      </label>
      <label>
        Dec
        <input
          v-model="decInput"
          autocomplete="off"
          spellcheck="false"
          placeholder="3.58428 · +03d35m03s"
          @keydown.enter.prevent="goToCoords"
        />
      </label>
      <label class="sky__search-wide">
        Survey
        <select v-model="surveyId" @change="applySurvey">
          <option v-for="s in SURVEYS" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </label>
      <button type="button" class="btn btn--gold" @click="goToCoords">Ir al punto</button>
      <button type="button" class="btn" @click="loadObservations">
        {{ obsLoading ? '…' : 'SPHEREx' }}
      </button>
      <button type="button" class="btn btn--ghost" @click="searchOpen = false">Cerrar</button>
      <p v-if="searchError" class="sky__search-err">{{ searchError }}</p>
    </div>

    <div v-if="status === 'ready' && shareOpen && !isEmbed" class="sky__search sky__share">
      <label class="sky__share-field">
        Enlace a esta vista
        <input ref="shareLinkField" :value="shareUrl" readonly @focus="selectField" />
      </label>
      <button type="button" class="btn btn--gold" @click="copyLink">
        {{ copyLabel('link', 'Copiar enlace') }}
      </button>
      <label class="sky__share-field">
        Código embed (iframe)
        <textarea
          ref="embedCodeField"
          :value="embedCode"
          readonly
          rows="3"
          @focus="selectField"
        />
      </label>
      <button type="button" class="btn" @click="copyEmbed">
        {{ copyLabel('embed', 'Copiar código embed') }}
      </button>
      <button type="button" class="btn btn--ghost" @click="shareOpen = false">Cerrar</button>
    </div>

    <aside v-if="status === 'ready' && catalogOpen && !isEmbed" class="panel panel--left">
      <div class="panel__head">
        <h2>Objetivos del reto</h2>
        <button type="button" class="panel__x" @click="catalogOpen = false">×</button>
      </div>
      <div class="panel__body">
        <p class="dest-lead">
          Un clic → centra (época {{ SPHEREX_EPOCH }}) + SPHEREx + blink.
        </p>
        <button
          v-for="t in officialPresets"
          :key="t.id"
          type="button"
          class="dest"
          :class="{ 'is-on': activeTarget?.id === t.id }"
          @click="visitPreset(t)"
        >
          <strong>{{ t.name }}</strong>
          <span>{{ presetCue(t) }}</span>
        </button>
        <p class="dest-group">Campos de sondeo</p>
        <button
          v-for="t in surveyPresets"
          :key="t.id"
          type="button"
          class="dest"
          :class="{ 'is-on': activeTarget?.id === t.id }"
          @click="visitPreset(t)"
        >
          <strong>{{ t.name }}</strong>
          <span>{{ t.highlight }}</span>
        </button>
      </div>
    </aside>

    <aside v-if="status === 'ready' && drawerOpen && !isEmbed" class="panel panel--right">
      <div class="panel__head">
        <div class="tabs">
          <button
            type="button"
            class="tab"
            :class="{ 'is-on': sideTab === 'info' }"
            @click="sideTab = 'info'"
          >
            Info
          </button>
          <button
            type="button"
            class="tab"
            :class="{ 'is-on': sideTab === 'stamps' }"
            @click="sideTab = 'stamps'"
          >
            Movimiento
          </button>
        </div>
        <button type="button" class="panel__x" @click="drawerOpen = false">×</button>
      </div>

      <div v-if="sideTab === 'info'" class="panel__body">
        <template v-if="activeTarget">
          <p class="info-name">{{ activeTarget.name }}</p>
          <p class="info-coords">
            {{ formatRaDec(activeTarget.ra, activeTarget.dec) }} · época {{ activeTarget.epoch }}
          </p>
          <p v-if="activeTarget.catalog_ra != null && activeTarget.catalog_dec != null" class="info-coords">
            Catálogo {{ activeTarget.catalog_epoch }}:
            {{ formatRaDec(activeTarget.catalog_ra, activeTarget.catalog_dec) }}
          </p>
          <p class="info-text"><strong>{{ activeTarget.highlight }}</strong></p>
          <p class="info-text">{{ activeTarget.description }}</p>
        </template>

        <p v-if="obsLoading" class="info-meta">Consultando IRSA…</p>
        <div v-else-if="obsError" class="info-err">
          <p>{{ obsError }}</p>
          <button type="button" class="btn btn--gold" @click="loadObservations">Reintentar</button>
        </div>
        <p v-else-if="obsResult" class="info-meta">
          {{ obsResult.count }} imágenes SPHEREx cerca
        </p>

        <ul v-if="obsPreview.length" class="obs">
          <li v-for="(obs, idx) in obsPreview" :key="String(obs.obs_id ?? idx)">
            <p>{{ shortObsId(obs.obs_id) }}</p>
            <span>{{ bandLabel(obs.energy_bandpassname) }} · {{ mjdToHint(obs.t_min) }}</span>
            <div class="obs__row">
              <button type="button" class="mini" @click="useObsTarget(obs)">Ir</button>
              <button
                v-if="obs.cutout_url"
                type="button"
                class="mini mini--gold"
                :title="hostFromUrl(obs.cutout_url)"
                @click="openExternal(obs.cutout_url)"
              >
                Cutout
              </button>
              <button
                v-if="obs.access_url"
                type="button"
                class="mini"
                @click="openExternal(obs.access_url)"
              >
                FITS
              </button>
            </div>
          </li>
        </ul>

        <button type="button" class="btn btn--ghost info-more" @click="openStampsTab">
          Ver movimiento SPHEREx →
        </button>
      </div>

      <div v-else class="panel__body stamps">
        <p v-if="activeTarget?.category === 'official_test'" class="info-text">
          <strong>{{ activeTarget.name }}.</strong> {{ activeTarget.highlight }}
        </p>
        <div class="stamp-modes">
          <button
            type="button"
            class="mode"
            :class="{ 'is-on': motionMode === 'spherex' }"
            @click="showSpherex"
          >
            SPHEREx
          </button>
          <button
            type="button"
            class="mode"
            :class="{ 'is-on': motionMode === 'wise' }"
            @click="showWiseCompare"
          >
            Comparar con WISE
          </button>
        </div>

        <SpherexPlayer
          v-if="motionMode === 'spherex' && playerRa != null && playerDec != null"
          :ra="playerRa"
          :dec="playerDec"
          :radius="motionRadius"
          :cutout-size="CUTOUT_SIZE_DEG"
        />
        <p v-else-if="motionMode === 'spherex'" class="info-err">No hay coordenadas válidas para el video.</p>

        <template v-else>
        <p class="info-text">
          <template v-if="stampMode === 'epochs'">
            Versión didáctica de WiseView: blink entre <strong>épocas unWISE</strong> (NEO2→NEO11).
            Equivale al sliding window + blink de WiseView, sin 15 sliders. Mismas coords, años
            distintos → se ve el movimiento. El atlas HD es el contexto.
          </template>
          <template v-else>
            Bandas ópticas PanSTARRS (como el recorte inferior de WiseView): brillo/color, no
            movimiento. Para ver desplazamiento, usa Épocas.
          </template>
        </p>

        <div class="stamp-modes">
          <button
            type="button"
            class="mode"
            :class="{ 'is-on': stampMode === 'epochs' }"
            @click="setStampMode('epochs')"
          >
            Épocas
          </button>
          <button
            type="button"
            class="mode"
            :class="{ 'is-on': stampMode === 'bands' }"
            @click="setStampMode('bands')"
          >
            Bandas PS1
          </button>
        </div>

        <div class="blink-row">
          <button
            type="button"
            class="btn btn--gold"
            :disabled="stamps.length < 2"
            @click="toggleBlink"
          >
            {{ blinkOn ? 'Stop' : stampMode === 'epochs' ? 'Blink movimiento' : 'Blink bandas' }}
          </button>
          <label>
            ms
            <input
              v-model.number="blinkMs"
              type="number"
              min="200"
              max="4000"
              step="100"
            />
          </label>
          <a
            v-if="stampMode === 'epochs' && wisePortal"
            class="link"
            :href="wisePortal"
            target="_blank"
            rel="noopener noreferrer"
          >WiseView</a>
          <a
            v-else-if="ps1Portal"
            class="link"
            :href="ps1Portal"
            target="_blank"
            rel="noopener noreferrer"
          >PS1</a>
        </div>

        <p v-if="stampLoading" class="info-meta">Cargando…</p>
        <p v-else-if="stampError" class="info-err">{{ stampError }}</p>

        <div v-if="activeStamp" class="stamp-hero" :class="{ 'is-epoch': stampMode === 'epochs' }">
          <img :src="activeStamp.jpegUrl" :alt="activeStamp.label" />
          <span>
            {{ activeStamp.label }}
            <small v-if="activeStamp.sub">{{ activeStamp.sub }}</small>
          </span>
        </div>

        <div v-if="stamps.length" class="stamp-grid">
          <button
            v-for="(stamp, idx) in stamps"
            :key="stamp.id"
            type="button"
            class="stamp"
            :class="{ 'is-on': idx === blinkIndex }"
            @click="selectStamp(idx)"
          >
            <img :src="stamp.jpegUrl" :alt="stamp.label" loading="eager" />
            <span>{{ stamp.label }}</span>
          </button>
        </div>
        </template>
      </div>
    </aside>
    <!-- Modo embed (?embed=1): solo atlas + reproductor compacto + enlace a la app -->
    <template v-if="status === 'ready' && isEmbed">
      <a class="embed-open" :href="fullAppUrl" target="_blank" rel="noopener noreferrer">
        Abrir en Planet-X ↗
      </a>
      <div class="embed-player">
        <strong class="embed-player__title">{{ activeTarget?.name || 'Cielo HD' }}</strong>
        <img v-if="activeStamp" :src="activeStamp.jpegUrl" :alt="activeStamp.label" />
        <p v-else class="embed-player__meta">
          {{ stampLoading ? 'Cargando épocas…' : stampError || 'Sin épocas disponibles' }}
        </p>
        <div class="embed-player__row">
          <button
            type="button"
            class="mini mini--gold"
            :disabled="stamps.length < 2"
            @click="toggleBlink"
          >
            {{ blinkOn ? 'Stop' : 'Blink' }}
          </button>
          <span v-if="activeStamp">
            {{ activeStamp.label }}
            <small v-if="activeStamp.sub">{{ activeStamp.sub }}</small>
          </span>
        </div>
      </div>
    </template>

    <footer v-if="status === 'ready' && !isEmbed" class="sky__bar">
      <div class="sky__bar-coords">
        <span>AR {{ liveRa }}°</span>
        <span>Dec {{ liveDec }}°</span>
        <span :class="backendOk ? 'ok' : 'bad'">{{ backendOk ? 'API ok' : 'API…' }}</span>
      </div>
      <div class="sky__bar-zoom">
        <button type="button" class="zoom-btn" @click="zoomBy(0.65)">+</button>
        <input v-model.number="zoomSlider" type="range" min="0" max="1000" />
        <button type="button" class="zoom-btn" @click="zoomBy(1.45)">−</button>
        <strong>{{ zoomLabel }}</strong>
      </div>
    </footer>

    <div v-if="status === 'loading'" class="sky__overlay">Cargando atlas…</div>
    <div v-else-if="status === 'error'" class="sky__overlay">
      <p>{{ errorMessage }}</p>
      <button type="button" class="btn btn--gold" @click="boot">Reintentar</button>
    </div>
  </div>
</template>

<style scoped>
.sky {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #000;
  color: #f2f5f8;
}

.sky__canvas {
  position: absolute;
  inset: 0;
}

.sky__canvas :deep(.aladin-container),
.sky__canvas :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
}

.sky__canvas :deep(.aladin-location),
.sky__canvas :deep(.aladin-fov),
.sky__canvas :deep(.aladin-status-bar),
.sky__canvas :deep(.aladin-cooFrame),
.sky__canvas :deep(.aladin-stack-control),
.sky__canvas :deep(.aladin-fullScreen-control),
.sky__canvas :deep(.aladin-zoom-control),
.sky__canvas :deep(.aladin-zoom-block) {
  display: none !important;
}

.sky__top,
.sky__search,
.panel,
.sky__bar,
.btn,
.dest,
.mini,
.tab,
.stamp,
.zoom-btn,
.sky__notice,
.embed-open,
.embed-player {
  pointer-events: auto;
}

.sky__top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 6;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.72), transparent 90%);
}

.sky__brand {
  pointer-events: none;
  max-width: min(48vw, 26rem);
  min-width: 0;
  transition: margin-left 0.2s ease;
}

/* Evita choque título ↔ panel Objetivos */
.sky__brand.is-pushed {
  margin-left: min(20rem, calc(100vw - 3rem));
  max-width: min(36vw, 22rem);
}

.sky__kicker {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 10px #000;
}

.sky__title {
  margin: 0.25rem 0 0;
  font-size: clamp(1.35rem, 2.6vw, 2rem);
  font-weight: 650;
  letter-spacing: 0.04em;
  line-height: 1.15;
  text-shadow: 0 2px 16px #000;
}

.sky__skyhint {
  margin: 0.3rem 0 0;
  font-size: 0.88rem;
  color: #ffe9b8;
  text-shadow: 0 1px 10px #000;
}

.sky__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-start;
  justify-content: flex-end;
  pointer-events: auto;
}

.sky__pill {
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(232, 196, 120, 0.45);
  background: rgba(0, 0, 0, 0.45);
  color: #ffe9b8;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.btn {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 0.6rem 0.9rem;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.btn--gold {
  border-color: rgba(232, 196, 120, 0.7);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.14);
}

.btn--ghost {
  background: rgba(0, 0, 0, 0.35);
}

.btn--on {
  border-color: rgba(232, 196, 120, 0.75);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.16);
}

.sky__search {
  position: absolute;
  top: 5.5rem;
  left: 50%;
  z-index: 7;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: end;
  width: min(920px, calc(100% - 2rem));
  padding: 1rem 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
  background: rgba(5, 7, 12, 0.94);
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.sky__search-err {
  flex: 1 0 100%;
  margin: 0;
  color: #fda4af;
  font-size: 0.92rem;
}

.sky__search label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
}

.sky__search input,
.sky__search select {
  min-width: 6.5rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 0.5rem 0.6rem;
  font-size: 1rem;
}

.sky__search-wide {
  min-width: 10rem;
}

.sky__share-field {
  flex: 1 1 100%;
}

.sky__share-field input,
.sky__share-field textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
  letter-spacing: 0;
  text-transform: none;
}

.sky__share-field textarea {
  resize: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 0.5rem 0.6rem;
}

.sky__notice {
  position: absolute;
  top: 5.5rem;
  left: 50%;
  z-index: 9;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: max-content;
  max-width: calc(100% - 2rem);
  padding: 0.6rem 0.75rem 0.6rem 1rem;
  border: 1px solid rgba(253, 164, 175, 0.55);
  border-radius: 0.6rem;
  background: rgba(30, 8, 12, 0.92);
  color: #fecdd3;
  font-size: 0.92rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}

.sky--embed .sky__notice {
  top: 0.75rem;
}

.embed-open {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 6;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(232, 196, 120, 0.6);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  color: #ffe9b8;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
}

.embed-player {
  position: absolute;
  left: 0.75rem;
  bottom: 0.75rem;
  z-index: 6;
  display: grid;
  gap: 0.4rem;
  width: min(11rem, calc(100% - 1.5rem));
  padding: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0.65rem;
  background: rgba(5, 7, 12, 0.82);
  backdrop-filter: blur(10px);
}

.embed-player__title {
  font-size: 0.85rem;
  font-weight: 650;
  line-height: 1.2;
}

.embed-player img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: #000;
}

.embed-player__meta {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.65);
}

.embed-player__row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
}

.embed-player__row small {
  display: block;
  letter-spacing: 0.02em;
  text-transform: none;
  color: rgba(255, 255, 255, 0.5);
}

.mini:disabled {
  opacity: 0.45;
}

.panel {
  position: absolute;
  top: 5.75rem;
  bottom: 4.75rem;
  z-index: 5;
  width: min(19rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0.85rem;
  background: rgba(5, 7, 12, 0.88);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.panel--left {
  left: 1rem;
}

.panel--right {
  right: 1rem;
  width: min(24rem, calc(100vw - 2rem));
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.panel__head h2 {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #ffe9b8;
}

.panel__x {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.4rem;
  line-height: 1;
  padding: 0 0.2rem;
}

.panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.85rem;
}

.tabs {
  display: flex;
  gap: 0.35rem;
}

.tab {
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  padding: 0.4rem 0.7rem;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tab.is-on {
  border-color: rgba(232, 196, 120, 0.5);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.1);
}

.dest-lead,
.dest-group {
  margin: 0 0 0.75rem;
  font-size: 0.86rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.62);
}

.dest-lead .ok {
  color: #9fd4ff;
}

.dest-lead .warn {
  color: #fda4af;
}

.dest-group {
  margin-top: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
}

.dest {
  display: grid;
  gap: 0.2rem;
  width: 100%;
  margin-bottom: 0.45rem;
  padding: 0.85rem 0.9rem;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  cursor: pointer;
}

.dest strong {
  font-size: 1.05rem;
}

.dest span {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.55);
}

.dest:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
}

/* Solo el objetivo activo brilla */
.dest.is-on {
  border-color: rgba(232, 196, 120, 0.85);
  background: rgba(232, 196, 120, 0.16);
  box-shadow: inset 3px 0 0 #e8c478;
}

.dest.is-on span {
  color: #ffe9b8;
}

.info-name {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 650;
}

.info-coords {
  margin: 0.35rem 0 0;
  font-family: ui-monospace, monospace;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.55);
}

.info-text {
  margin: 0.85rem 0 0;
  font-size: 0.98rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.78);
}

.info-meta {
  margin: 1rem 0 0;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.85);
}

.info-err {
  margin-top: 1rem;
  color: #fda4af;
  font-size: 0.95rem;
  display: grid;
  gap: 0.6rem;
}

.info-more {
  margin-top: 1rem;
  width: 100%;
}

.obs {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.obs li {
  padding: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.04);
}

.obs p {
  margin: 0;
  font-size: 1rem;
}

.obs span {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.55);
}

.obs__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.mini {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  padding: 0.35rem 0.55rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mini--gold {
  border-color: rgba(232, 196, 120, 0.55);
  color: #ffe9b8;
}

.stamp-modes {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.65rem;
}

.mode {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.75);
  padding: 0.45rem 0.55rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.mode.is-on {
  border-color: rgba(232, 196, 120, 0.7);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.12);
}

.blink-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  margin: 0.85rem 0;
}

.blink-row label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.blink-row input {
  width: 4.2rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 0.35rem;
}

.link {
  color: #9fd4ff;
  text-decoration: underline;
  font-size: 0.9rem;
}

.stamp-hero {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.stamp-hero img {
  width: min(100%, 220px);
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: #000;
  image-rendering: auto;
}

.stamp-hero.is-epoch img {
  width: min(100%, 300px);
}

.stamp-hero span {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
}

.stamp-hero small {
  letter-spacing: 0.04em;
  text-transform: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.78rem;
}

.stamp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}

.stamp {
  display: grid;
  gap: 0.2rem;
  padding: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stamp.is-on {
  border-color: rgba(232, 196, 120, 0.7);
}

.stamp img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: #000;
}

.sky__bar {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  z-index: 5;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  width: min(720px, calc(100% - 2rem));
  padding: 0.7rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(5, 7, 12, 0.78);
  backdrop-filter: blur(12px);
}

.sky__bar-coords {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-family: ui-monospace, monospace;
  font-size: 0.92rem;
}

.sky__bar-coords .ok {
  color: #86efac;
}

.sky__bar-coords .bad {
  color: #fda4af;
}

.sky__bar-zoom {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: min(100%, 16rem);
}

.sky__bar-zoom input {
  flex: 1;
  accent-color: #e8c478;
}

.sky__bar-zoom strong {
  min-width: 3.2rem;
  color: #ffe9b8;
  font-size: 0.95rem;
}

.zoom-btn {
  width: 2rem;
  height: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 1.1rem;
}

.sky__overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-content: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.78);
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
  padding: 1.5rem;
}

@media (max-width: 900px) {
  .sky__top {
    flex-direction: column;
    align-items: stretch;
  }

  .sky__brand,
  .sky__brand.is-pushed {
    max-width: none;
    margin-left: 0;
  }

  .sky__actions {
    justify-content: flex-start;
  }

  .panel {
    top: auto;
    bottom: 4.75rem;
    width: calc(100% - 2rem);
    max-height: 40vh;
    left: 1rem;
    right: 1rem;
  }

  .panel--left {
    display: none;
  }

  .sky__bar {
    border-radius: 1rem;
  }
}
</style>
