<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import {
  LOCAL_HIPS,
  applyLocalHips,
  loadAladinLite,
  patchAladinNetwork,
  presetSurvey,
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
import FloatingMotionWindow from '@/components/mission/FloatingMotionWindow.vue'
import MissionGuidePanel from '@/components/mission/MissionGuidePanel.vue'
import MissionOnboardingTour from '@/components/mission/MissionOnboardingTour.vue'
import SpherexDetailWindow, {
  type DetailObs,
} from '@/components/mission/SpherexDetailWindow.vue'
import { useFramePlayer } from '@/composables/useFramePlayer'
import {
  useMissionOnboarding,
  type MissionTourStepId,
} from '@/composables/useMissionOnboarding'
import LanguageToggle from '@/components/common/LanguageToggle.vue'
import { useI18n } from '@/composables/useI18n'
import { resolveMissionOnboarding } from '@/data/missionOnboardingCopy'
import {
  fetchPanstarrsStamps,
  panstarrsPortalUrl,
} from '@/services/panstarrs'
import SharpPhotoLayer from '@/components/mission/SharpPhotoLayer.vue'
import CutoutPulseOverlay from '@/components/mission/CutoutPulseOverlay.vue'
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
  FOV_NEBULA,
  FOV_SOFT_LIMIT,
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

/** Desplazamiento mínimo (grados) a partir del cual una vista llegada por URL o paneo recarga datos. */
const RELOAD_DISTANCE_DEG = 1 / 60
/** Espera tras el último paneo antes de anclar capturas al centro del atlas. */
const CAPTURE_SYNC_DEBOUNCE_MS = 550
/** Con el blink abierto, más espera para no cancelar cargas IRSA a mitad. */
const CAPTURE_SYNC_FLOAT_DEBOUNCE_MS = 1200
/**
 * Tope del radio para mantener un objetivo del catálogo seleccionado.
 * No usar fov_deg (surveys de 10–20° dejan el highlight “pegado”).
 */
const TARGET_HIGHLIGHT_CAP_DEG = 1.5
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
/** Resultado de la prueba de tiles al arrancar: si ESA no respondió, los presets usan IRSA. */
let esaReachable = true
const skyAspect = ref(1.6)
const aladinApi = shallowRef<AladinAPI | null>(null)
const skyHint = ref('')
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
/** Reproductor SPHEREx en ventana flotante (no embebido abajo a la derecha). */
const spherexFloatOpen = ref(false)
const spherexFloatTick = ref(0)
/** Visor 2D real + metadatos ObsCore. */
const detailOpen = ref(false)
const detailTick = ref(0)
const detailObs = ref<DetailObs | null>(null)
/** True cuando el atlas óptico ya no puede afilar más (límite DSS). */
const atlasAtLimit = ref(false)
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
const { m: i18nMessages } = useI18n()
const ui = computed(() => i18nMessages.value.mission.ui)

function setSkyHint(
  key: keyof typeof i18nMessages.value.mission.ui,
  detail?: string,
) {
  const base = i18nMessages.value.mission.ui[key]
  skyHint.value = detail ? `${base}${detail}` : base
}

async function prepareOnboardingStep(id: MissionTourStepId) {
  searchOpen.value = false
  shareOpen.value = false
  detailOpen.value = false

  if (id === 'atlas') {
    catalogOpen.value = false
    drawerOpen.value = false
    spherexFloatOpen.value = false
    return
  }
  if (id === 'targets') {
    catalogOpen.value = true
    drawerOpen.value = false
    spherexFloatOpen.value = false
    return
  }
  if (id === 'data') {
    // Solo el panel Datos: evita apilar catálogo + drawer y sacar la guía del viewport.
    catalogOpen.value = false
    drawerOpen.value = true
    sideTab.value = 'info'
    spherexFloatOpen.value = false
    return
  }
  if (id === 'motion') {
    catalogOpen.value = false
    drawerOpen.value = true
    sideTab.value = 'stamps'
    motionMode.value = 'spherex'
    spherexFloatOpen.value = false
    return
  }
  // interpret — blink en tarjeta flotante; el atlas no se parte.
  catalogOpen.value = false
  drawerOpen.value = false
  sideTab.value = 'stamps'
  motionMode.value = 'spherex'
  openSpherexFloat()
}

const {
  tourActive,
  guideOpen,
  stepIndex: onboardingStepIndex,
  stepId: onboardingStepId,
  stepCount: onboardingStepCount,
  isFirst: onboardingIsFirst,
  isLast: onboardingIsLast,
  targetRect: onboardingTargetRect,
  startTour,
  skipTour,
  nextStep: onboardingNext,
  prevStep: onboardingPrev,
  closeGuide,
  toggleGuide,
  tryAutoStart,
  remountMeasure,
} = useMissionOnboarding({
  isEmbed,
  prepareStep: prepareOnboardingStep,
})

/** Después del composable: el tour ya existe. Nunca undefined en el render. */
const onboardingCopy = computed(() =>
  resolveMissionOnboarding(i18nMessages.value?.mission?.onboarding),
)
const tourStepCopy = computed(() => {
  const steps = onboardingCopy.value.steps
  return steps[onboardingStepId.value] ?? steps.atlas
})
const tourProgressLabel = computed(() =>
  onboardingCopy.value.progress
    .replace('{current}', String(onboardingStepIndex.value + 1))
    .replace('{total}', String(onboardingStepCount)),
)

const urlNotice = ref<string | null>(null)
const shareOpen = ref(false)
const copyFeedback = ref<CopyFeedback | null>(null)
const shareLinkField = ref<HTMLInputElement | null>(null)
const embedCodeField = ref<HTMLTextAreaElement | null>(null)

let coordTimer: ReturnType<typeof setInterval> | null = null
let captureSyncTimer: ReturnType<typeof setTimeout> | null = null
/** Último centro vivo visto por el debounce (evita reiniciar el timer en cada poll). */
let lastCaptureLiveKey = ''
let noticeTimer: ReturnType<typeof setTimeout> | null = null
let copyTimer: ReturnType<typeof setTimeout> | null = null
let journeyToken = 0
let stampLoadToken = 0
let obsLoadToken = 0
let captureSyncToken = 0
/** Tras un 503 de IRSA, no martillar /api/observations en cada pan. */
let obsOutageUntil = 0
/** true mientras se aplica una vista llegada por URL: no se re-escribe la URL. */
let syncingFromUrl = false

function isIrsaObsOutage(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('HTTP 503') ||
    msg.includes('HTTP 502') ||
    msg.includes('HTTP 504') ||
    msg.includes('Tiempo agotado') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('IRSA')
  )
}

function friendlyObsError(error: unknown): string {
  if (isIrsaObsOutage(error)) {
    return 'IRSA no responde ahora (proxy/SIA). El atlas sigue; prueba el blink o reintenta en un momento.'
  }
  if (error instanceof Error && error.message.includes('HTTP 404')) {
    return 'No hay capturas SPHEREx cerca de este punto.'
  }
  return 'No se pudieron cargar las observaciones SPHEREx.'
}

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
  stage.value === 'flying'
    ? ui.value.stageFlying
    : stage.value === 'hd'
      ? 'HD'
      : ui.value.stageReady,
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

/** FOV del atlas para un preset (DSS no baja de FOV_MIN). */
function presetFov(preset: PresetLocation | null): number {
  if (!preset) return FOV_NEBULA
  // Campos / nebulosas: FOV amplio para que el HiPS se vea “real”, no a bloques.
  if (preset.category === 'survey_field') {
    return Math.min(FOV_MAX, Math.max(FOV_NEBULA, preset.fov_deg || FOV_NEBULA))
  }
  return Math.min(FOV_MAX, Math.max(FOV_MIN, Math.max(preset.fov_deg, FOV_MIN)))
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

let bootLock = false

async function boot() {
  if (!host.value || bootLock) return
  bootLock = true
  status.value = 'loading'
  errorMessage.value = ''
  setSkyHint('preparing')
  patchAladinNetwork()
  const slow = window.setTimeout(() => {
    if (status.value === 'loading') {
      setSkyHint('slowAtlas')
    }
  }, 8000)

  try {
    await nextTick()
    if (!host.value) return
    await waitForHostSize(host.value)

    const A = await loadAladinLite()
    aladinApi.value = A
    if (!host.value) return

    host.value.innerHTML = ''
    const parsed = readFromQuery(route.query)
    const start = resolveStartView(parsed.state)
    const target = `${start.ra} ${start.dec}`
    const startFov = start.fov

    raInput.value = start.ra.toFixed(6)
    decInput.value = start.dec.toFixed(6)
    fovInput.value = roundFov(startFov)
    showUrlNotice(describeInvalidQuery(parsed))

    // ESA a veces no contesta. IRSA DSS sí, y el cielo puede abrir igual.
    setSkyHint('checkingTiles')
    const hipsOrder: LocalHipsId[] = ['esa-dss', 'dss2-color']
    let hipsUrl = ''
    for (const id of hipsOrder) {
      try {
        const probe = await fetch(`${LOCAL_HIPS[id].url}/properties`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        })
        if (!probe.ok) continue
        surveyId.value = id
        hipsUrl = LOCAL_HIPS[id].url
        break
      } catch {
        /* timeout o red: prueba el siguiente mapa */
      }
    }
    esaReachable = hipsUrl === LOCAL_HIPS['esa-dss'].url
    if (!hipsUrl) {
      throw new Error('El mapa del cielo no respondió. Pulsa Reintentar.')
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

    applyLocalHips(A, aladin, surveyId.value)
    refreshAladinView(aladin, host.value)

    window.setTimeout(() => {
      try {
        applyLocalHips(A, aladin, surveyId.value)
        aladin.gotoRaDec(start.ra, start.dec)
        setAladinFoV(aladin, startFov)
        refreshAladinView(aladin, host.value)
        setSkyHint('atlasReady')
      } catch {
        setSkyHint('atlasUnstable')
      }
    }, 400)

    aladinRef.value = aladin
    status.value = 'ready'
    stage.value = 'hd'
    activeTarget.value = start.target
    stageHint.value =
      start.target?.name ?? `Apuntando AR ${start.ra.toFixed(5)}° · Dec ${start.dec.toFixed(5)}°`
    syncCoords()
    measureSky()
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
    setSkyHint('atlasError')
  } finally {
    window.clearTimeout(slow)
    bootLock = false
  }
}

function startCoordWatch() {
  stopCoordWatch()
  coordTimer = setInterval(() => {
    syncCoords()
    syncFoVFromAladin()
  }, 400)
}

function cancelCaptureSync() {
  if (captureSyncTimer) {
    clearTimeout(captureSyncTimer)
    captureSyncTimer = null
  }
  lastCaptureLiveKey = ''
  captureSyncToken += 1
}

function stopCoordWatch() {
  if (coordTimer) {
    clearInterval(coordTimer)
    coordTimer = null
  }
  cancelCaptureSync()
}

function syncCoords() {
  const aladin = aladinRef.value
  if (!aladin) return
  try {
    const [ra, dec] = aladin.getRaDec()
    const raN = Number(ra)
    const decN = Number(dec)
    liveRa.value = raN.toFixed(5)
    liveDec.value = decN.toFixed(5)
    // El dorado del catálogo = “estás en este objetivo”, no “último clic”.
    // Si el centro del atlas se aleja, se apaga el bloque.
    syncActiveTargetHighlight(raN, decN)
    scheduleCaptureSyncFromLive()
  } catch {
    /* ignore */
  }
}

/**
 * Tras panear, ancla stampRa/Dec (y recarga obs/sellos) al centro vivo.
 * Debounce trailing: solo reinicia el timer cuando el centro vivo cambia
 * (el poll de syncCoords es más frecuente que el debounce).
 */
function scheduleCaptureSyncFromLive() {
  if (status.value !== 'ready' || stage.value === 'flying' || syncingFromUrl) return
  const ra = Number(liveRa.value)
  const dec = Number(liveDec.value)
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return

  const liveKey = `${ra.toFixed(5)},${dec.toFixed(5)}`
  const prevRa = stampRa.value
  const prevDec = stampDec.value
  const moved =
    prevRa == null ||
    prevDec == null ||
    angularDistanceDeg(ra, dec, prevRa, prevDec) > RELOAD_DISTANCE_DEG

  if (!moved) {
    lastCaptureLiveKey = liveKey
    if (captureSyncTimer) {
      clearTimeout(captureSyncTimer)
      captureSyncTimer = null
    }
    return
  }

  if (liveKey === lastCaptureLiveKey) return
  lastCaptureLiveKey = liveKey

  if (captureSyncTimer) clearTimeout(captureSyncTimer)
  const waitMs = spherexFloatOpen.value ? CAPTURE_SYNC_FLOAT_DEBOUNCE_MS : CAPTURE_SYNC_DEBOUNCE_MS
  captureSyncTimer = setTimeout(() => {
    captureSyncTimer = null
    applyCaptureSyncFromLive()
  }, waitMs)
}

function applyCaptureSyncFromLive() {
  if (status.value !== 'ready' || stage.value === 'flying' || syncingFromUrl) return
  const ra = Number(liveRa.value)
  const dec = Number(liveDec.value)
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) return

  // Catálogo estático: si el centro ya no coincide con el objetivo, quitar selección.
  syncActiveTargetHighlight(ra, dec)

  const prevRa = stampRa.value
  const prevDec = stampDec.value
  const moved =
    prevRa == null ||
    prevDec == null ||
    angularDistanceDeg(ra, dec, prevRa, prevDec) > RELOAD_DISTANCE_DEG
  if (!moved) return

  const token = ++captureSyncToken
  stampRa.value = ra
  stampDec.value = dec
  raInput.value = ra.toFixed(6)
  decInput.value = dec.toFixed(6)

  const jobs: Promise<unknown>[] = []
  if (!isEmbed.value) jobs.push(loadObservationsAt(ra, dec, OBS_RADIUS_ARCSEC))
  if (isEmbed.value || motionMode.value === 'wise') jobs.push(loadStampsAt(ra, dec))
  if (!jobs.length) return

  void Promise.all(jobs).then(() => {
    if (token !== captureSyncToken) return
    if (
      skyHint.value.startsWith(ui.value.centering) ||
      skyHint.value.startsWith(ui.value.pointReady)
    ) {
      setSkyHint('pointReady')
    }
  })
}

/** Radio de highlight del catálogo: radius del preset, acotado (ignora fov_deg). */
function targetHighlightLimitDeg(t: PresetLocation): number {
  return Math.min(Math.max(t.radius_deg || 0, 0.4), TARGET_HIGHLIGHT_CAP_DEG)
}

/** Apaga el preset activo si el cielo ya no apunta a ese objeto. */
function syncActiveTargetHighlight(ra: number, dec: number) {
  const t = activeTarget.value
  if (!t || stage.value === 'flying') return
  if (angularDistanceDeg(ra, dec, t.ra, t.dec) <= targetHighlightLimitDeg(t)) return
  clearActiveTarget(ra, dec)
}

/** Deselección explícita del objetivo del catálogo estático. */
function clearActiveTarget(ra?: number, dec?: number) {
  const t = activeTarget.value
  if (!t) return
  activeTarget.value = null
  const raN = ra ?? Number(liveRa.value)
  const decN = dec ?? Number(liveDec.value)
  if (
    Number.isFinite(raN) &&
    Number.isFinite(decN) &&
    (stageHint.value === t.name || stageHint.value.startsWith(t.name))
  ) {
    stageHint.value = `AR ${raN.toFixed(5)}° · Dec ${decN.toFixed(5)}°`
  }
}

function syncFoVFromAladin() {
  const aladin = aladinRef.value
  if (!aladin || stage.value === 'flying') return
  try {
    const fov = aladin.getFov?.()?.[0]
    if (typeof fov !== 'number' || !Number.isFinite(fov)) return
    // Tope duro (como antes): se puede acercar hasta FOV_MIN.
    if (fov < FOV_MIN) {
      setAladinFoV(aladin, FOV_MIN)
      fovInput.value = FOV_MIN
      atlasAtLimit.value = true
      return
    }
    atlasAtLimit.value = fov <= FOV_SOFT_LIMIT
    const rounded = roundFov(fov)
    const current = Number(fovInput.value)
    // Umbral relativo (1 %): con FOV pequeños un 0.01° fijo ocultaba el zoom de la URL.
    const threshold = Math.max(0.001, Math.abs(current) * 0.01)
    if (!Number.isFinite(current) || Math.abs(rounded - current) > threshold) {
      fovInput.value = rounded
    }
    try {
      aladin.removeImageLayer?.('ps1-hd')
    } catch {
      /* la capa FITS vieja se dibujaba a bloques */
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

/** Lado del recorte en el atlas: SPHEREx 0.08°; WISE ~280 px × 2.75″. */
const footprintSizeDeg = computed(() =>
  motionMode.value === 'wise' ? (280 * 2.75) / 3600 : CUTOUT_SIZE_DEG,
)

const footprintLabel = computed(() => {
  if (motionMode.value === 'wise') return 'Recorte WISE'
  if (spherexFloatOpen.value) return 'Recorte blink'
  return 'Recorte SPHEREx'
})

const footprintVisible = computed(
  () =>
    status.value === 'ready' &&
    !isEmbed.value &&
    playerRa.value != null &&
    playerDec.value != null &&
    Number.isFinite(Number(liveRa.value)) &&
    Number.isFinite(Number(liveDec.value)),
)

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
  // Ancla el punto de captura ya: evita que el debounce de paneo dispare otra carga.
  cancelCaptureSync()
  stampRa.value = ra
  stampDec.value = dec
  // Coord manual distinta del catálogo → quitar objetivo seleccionado.
  syncActiveTargetHighlight(ra, dec)

  // FOV útil para ver el campo (si está muy abierto parece “cualquier cielo”).
  if (!Number.isFinite(Number(fovInput.value)) || Number(fovInput.value) > 2) {
    fovInput.value = Math.max(FOV_MIN, 0.55)
  }

  aladin.gotoRaDec(ra, dec)
  applyFoVLive()
  refreshAladinView(aladin, host.value)
  syncCoords()
  stage.value = 'hd'
  if (!activeTarget.value) {
    stageHint.value = `Apuntando AR ${ra.toFixed(5)}° · Dec ${dec.toFixed(5)}°`
  }
  setSkyHint('centering')
  drawerOpen.value = true
  sideTab.value = 'info'
  void Promise.all([loadObservationsAt(ra, dec, 90), loadStampsAt(ra, dec)]).then(() => {
    setSkyHint('pointReady')
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

/** Clic en un cutout SPHEREx → Aladin mira el mismo parche (contexto DSS óptico). */
async function focusCutoutOnAtlas(payload: { ra: number; dec: number; fovDeg: number }) {
  const aladin = aladinRef.value
  if (!aladin || status.value !== 'ready') {
    setSkyHint('atlasNotReady')
    return
  }
  const token = ++journeyToken
  const targetFov = Math.min(FOV_MAX, Math.max(FOV_MIN, payload.fovDeg))
  const from = Math.min(FOV_MAX, Math.max(FOV_MIN, Number(fovInput.value) || 2))
  cancelCaptureSync()
  raInput.value = payload.ra.toFixed(6)
  decInput.value = payload.dec.toFixed(6)
  stampRa.value = payload.ra
  stampDec.value = payload.dec
  aladin.gotoRaDec(payload.ra, payload.dec)
  syncCoords()
  atlasAtLimit.value = targetFov <= FOV_SOFT_LIMIT
  setSkyHint('fieldCentered', `${targetFov.toFixed(2)}°`)
  stage.value = 'hd'
  stageHint.value = 'Contexto óptico del recorte'
  await animateFoV(from, targetFov, 700, token)
  if (token !== journeyToken) return
  refreshAladinView(aladin, host.value)
}

function zoomBy(factor: number) {
  const current = Number(fovInput.value) || 2
  const next = Math.min(FOV_MAX, Math.max(FOV_MIN, current * factor))
  fovInput.value = Number(next.toFixed(next < 1 ? 3 : 2))
  applyFoVLive()
  atlasAtLimit.value = next <= FOV_SOFT_LIMIT
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

async function loadObservationsAt(ra: number, dec: number, radius = 90, force = false) {
  const token = ++obsLoadToken
  if (!force && Date.now() < obsOutageUntil) {
    obsLoading.value = false
    if (!obsError.value) {
      obsError.value = 'IRSA sigue saturado · espera un momento o abre el blink.'
    }
    return
  }

  obsLoading.value = true
  obsError.value = null
  try {
    const result = await fetchObservations({
      ra,
      dec,
      radius,
      collection: 'spherex_dr1',
      cutout_size: CUTOUT_SIZE_DEG,
    })
    if (token !== obsLoadToken) return
    obsResult.value = result
    obsError.value = null
    obsOutageUntil = 0
    obsLoading.value = false
  } catch (error) {
    if (token !== obsLoadToken) return
    if (isIrsaObsOutage(error)) {
      // Evita ráfagas 503 en consola al panear / HMR.
      obsOutageUntil = Date.now() + 45_000
    }
    obsError.value = friendlyObsError(error)
    obsResult.value = null
    obsLoading.value = false
  }
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
  const jobs: Promise<unknown>[] = [loadObservationsAt(ra, dec, OBS_RADIUS_ARCSEC, true)]
  if (motionMode.value === 'wise') jobs.push(loadStampsAt(ra, dec))
  await Promise.all(jobs)
}

function retryObservations() {
  void loadObservations()
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
  openSpherexFloat()
}

async function showWiseCompare() {
  motionMode.value = 'wise'
  spherexFloatOpen.value = false
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
  motionMode.value = 'spherex'
  stopBlink()
  openSpherexFloat()
}

function openSpherexFloat() {
  motionMode.value = 'spherex'
  stopBlink()
  drawerOpen.value = false
  detailOpen.value = false
  // El blink es tarjeta flotante: no parte el atlas; cerramos Objetivos para no tapar el cielo.
  catalogOpen.value = false
  spherexFloatOpen.value = true
  spherexFloatTick.value += 1
}

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
  if (drawerOpen.value) spherexFloatOpen.value = false
}

function presetTip(t: PresetLocation): string {
  return [t.highlight, t.description].filter(Boolean).join(' — ')
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

/** Clic en objetivo ya activo → deseleccionar; si no, visitar el preset. */
function toggleCatalogTarget(target: PresetLocation) {
  if (activeTarget.value?.id === target.id) {
    clearActiveTarget()
    return
  }
  void visitPreset(target)
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
  sideTab.value = 'info'
  if (target.category === 'official_test') {
    motionMode.value = 'spherex'
    openSpherexFloat()
  } else {
    spherexFloatOpen.value = false
  }

  stage.value = 'flying'
  stageHint.value = target.name
  cancelCaptureSync()
  stampRa.value = target.ra
  stampDec.value = target.dec
  motionRadius.value = OBS_RADIUS_ARCSEC

  // Nebulosas / campos: DSS color se ve más “real” al acercarse con tiles HD.
  // Si ESA no respondió al arrancar, se queda en IRSA.
  surveyId.value = presetSurvey(target.category, esaReachable)
  applySurvey()
  // Atlas: FOV cómodo para DSS. El zoom extremo SPHEREx es Detalle / Blink.
  const atlasFov = Math.min(FOV_MAX, Math.max(FOV_MIN, fovHd))
  const wide = Math.min(8, Math.max(atlasFov * 4, atlasFov + 0.5))
  aladin.gotoRaDec(target.ra, target.dec)
  setAladinFoV(aladin, wide)
  fovInput.value = wide
  atlasAtLimit.value = false
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

function openObsDetail(obs: Record<string, unknown>) {
  detailObs.value = {
    ...obs,
    // Si el SIA no trae s_ra/s_dec, usa el punto actual del atlas.
    s_ra: obs.s_ra ?? obs.ra ?? stampRa.value ?? parseCoord(raInput.value, 'ra'),
    s_dec: obs.s_dec ?? obs.dec ?? stampDec.value ?? parseCoord(decInput.value, 'dec'),
    collection: obs.collection ?? 'spherex_dr1',
  }
  detailOpen.value = true
  detailTick.value += 1
  setSkyHint('detailPrefix', shortObsId(obs.obs_id))
}

function openExternal(url: unknown) {
  if (typeof url !== 'string' || !url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function measureSky() {
  const el = host.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) skyAspect.value = rect.width / rect.height
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

watch(spherexFloatOpen, () => {
  void nextTick(() => {
    measureSky()
    const aladin = aladinRef.value
    if (aladin) refreshAladinView(aladin, host.value)
  })
})

watch(
  () => status.value === 'ready' && !isEmbed.value,
  (ready) => {
    if (ready) void tryAutoStart()
  },
)

watch(guideOpen, (open) => {
  if (open) spherexFloatOpen.value = false
})

onMounted(() => {
  document.documentElement.classList.add('is-explorer')
  document.documentElement.classList.remove('is-look-locked')
  window.addEventListener('resize', measureSky)
  void boot()
})

onUnmounted(() => {
  journeyToken += 1
  captureSyncToken += 1
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
  window.removeEventListener('resize', measureSky)
  document.documentElement.classList.remove('is-explorer')
})
</script>

<template>
  <div class="sky" :class="{ 'sky--embed': isEmbed }">
    <div ref="host" class="sky__canvas" aria-label="Atlas Aladin Lite" />
    <SharpPhotoLayer
      v-if="status === 'ready' && !isEmbed"
      :ra="Number(liveRa)"
      :dec="Number(liveDec)"
      :fov-deg="Number(fovInput) || 2"
      :aspect="skyAspect"
      :enabled="stage !== 'flying'"
    />
    <CutoutPulseOverlay
      v-if="footprintVisible && playerRa != null && playerDec != null"
      :ra="playerRa"
      :dec="playerDec"
      :size-deg="footprintSizeDeg"
      :center-ra="Number(liveRa)"
      :center-dec="Number(liveDec)"
      :fov-deg="Number(fovInput) || 2"
      :aspect="skyAspect"
      :label="footprintLabel"
      :emphasized="spherexFloatOpen"
    />
    <!-- HUD: una sola franja superior, sin FABs sueltos que choquen -->
    <header v-if="!isEmbed" class="sky__top">
      <div
        class="sky__brand"
        data-tour="atlas"
        :class="{ 'is-pushed': catalogOpen }"
      >
        <p class="sky__kicker">{{ ui.kicker }} · {{ stageLabel }}</p>
        <h1 class="sky__title">{{ activeTarget?.name || ui.defaultTitle }}</h1>
        <p v-if="!catalogOpen" class="sky__skyhint">{{ skyHint }}</p>
      </div>
      <div class="sky__actions">
        <LanguageToggle compact />
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': catalogOpen }"
          @click="catalogOpen = !catalogOpen"
        >
          {{ ui.targets }}
        </button>
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': drawerOpen }"
          @click="toggleDrawer"
        >
          {{ ui.data }}
        </button>
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': searchOpen }"
          @click="toggleSearch"
        >
          {{ ui.search }}
        </button>
        <button type="button" class="btn" @click="openStampsTab">{{ ui.stamps }}</button>
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': shareOpen }"
          @click="toggleShare"
        >
          {{ ui.share }}
        </button>
        <button
          type="button"
          class="btn"
          :class="{ 'btn--on': guideOpen || tourActive }"
          :title="onboardingCopy.openGuide || ui.guide"
          @click="toggleGuide"
        >
          {{ onboardingCopy.openGuide || ui.guide }}
        </button>
        <button
          type="button"
          class="btn btn--gold"
          :title="ui.threeDTitle"
          @click="openIn3d"
        >
          3D
        </button>
        <button type="button" class="btn btn--ghost" @click="goBack">{{ ui.exit }}</button>
      </div>
    </header>

    <div v-if="urlNotice" class="sky__notice" role="status">
      <span>{{ urlNotice }}</span>
      <button type="button" class="panel__x" :aria-label="ui.closeNotice" @click="showUrlNotice(null)">
        ×
      </button>
    </div>

    <div v-if="status === 'ready' && searchOpen && !isEmbed" class="sky__search">
      <label>
        RA
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
      <button type="button" class="btn btn--gold" @click="goToCoords">{{ ui.goToPoint }}</button>
      <button type="button" class="btn" @click="loadObservations">
        {{ obsLoading ? '…' : 'SPHEREx' }}
      </button>
      <button type="button" class="btn btn--ghost" @click="searchOpen = false">{{ ui.close }}</button>
      <p v-if="searchError" class="sky__search-err">{{ searchError }}</p>
    </div>

    <div v-if="status === 'ready' && shareOpen && !isEmbed" class="sky__search sky__share">
      <label class="sky__share-field">
        {{ ui.shareLink }}
        <input ref="shareLinkField" :value="shareUrl" readonly @focus="selectField" />
      </label>
      <button type="button" class="btn btn--gold" @click="copyLink">
        {{ copyLabel('link', ui.copyLink) }}
      </button>
      <label class="sky__share-field">
        {{ ui.embedCode }}
        <textarea
          ref="embedCodeField"
          :value="embedCode"
          readonly
          rows="3"
          @focus="selectField"
        />
      </label>
      <button type="button" class="btn" @click="copyEmbed">
        {{ copyLabel('embed', ui.copyEmbed) }}
      </button>
      <button type="button" class="btn btn--ghost" @click="shareOpen = false">{{ ui.close }}</button>
    </div>

    <aside
      v-if="status === 'ready' && catalogOpen && !isEmbed"
      class="panel panel--left panel--catalog"
    >
      <div class="panel__head" data-tour="targets">
        <h2>{{ ui.targets }}</h2>
        <button type="button" class="panel__x" @click="catalogOpen = false">{{ ui.close }}</button>
      </div>
      <div class="panel__body panel__body--catalog">
        <button
          v-for="t in officialPresets"
          :key="t.id"
          type="button"
          class="dest"
          :class="{ 'is-on': activeTarget?.id === t.id }"
          :title="activeTarget?.id === t.id ? ui.deselect : presetTip(t)"
          @click="toggleCatalogTarget(t)"
        >
          <strong>{{ t.name }}</strong>
          <span>{{ presetCue(t) }}</span>
        </button>
        <p class="dest-group">{{ ui.fields }}</p>
        <button
          v-for="t in surveyPresets"
          :key="t.id"
          type="button"
          class="dest"
          :class="{ 'is-on': activeTarget?.id === t.id }"
          :title="activeTarget?.id === t.id ? ui.deselect : presetTip(t)"
          @click="toggleCatalogTarget(t)"
        >
          <strong>{{ t.name }}</strong>
          <span>{{ ui.field }}</span>
        </button>
      </div>
    </aside>

    <aside
      v-if="status === 'ready' && drawerOpen && !isEmbed"
      class="panel panel--right"
    >
      <div
        class="panel__head"
        :data-tour="sideTab === 'info' ? 'data' : undefined"
      >
        <div class="tabs">
          <button
            type="button"
            class="tab"
            :class="{ 'is-on': sideTab === 'info' }"
            @click="sideTab = 'info'"
          >
            {{ ui.info }}
          </button>
          <button
            type="button"
            class="tab"
            :class="{ 'is-on': sideTab === 'stamps' }"
            @click="sideTab = 'stamps'"
          >
            {{ ui.motion }}
          </button>
        </div>
        <button type="button" class="panel__x" @click="drawerOpen = false">{{ ui.close }}</button>
      </div>

      <div v-if="sideTab === 'info'" class="panel__body">
        <template v-if="activeTarget">
          <p class="info-name">{{ activeTarget.name }}</p>
          <p class="info-coords">
            {{ formatRaDec(activeTarget.ra, activeTarget.dec) }} · {{ ui.epoch }} {{ activeTarget.epoch }}
          </p>
          <p v-if="activeTarget.catalog_ra != null && activeTarget.catalog_dec != null" class="info-coords">
            {{ ui.catalog }} {{ activeTarget.catalog_epoch }}:
            {{ formatRaDec(activeTarget.catalog_ra, activeTarget.catalog_dec) }}
          </p>
          <p class="info-text"><strong>{{ activeTarget.highlight }}</strong></p>
          <p class="info-text">{{ activeTarget.description }}</p>
        </template>
        <template v-else>
          <p class="info-name">{{ ui.freeField }}</p>
          <p class="info-coords">
            {{ formatRaDec(Number(liveRa === '—' ? raInput : liveRa), Number(liveDec === '—' ? decInput : liveDec)) }}
          </p>
          <p class="info-text">{{ ui.freeFieldBody }}</p>
        </template>

        <p v-if="obsLoading" class="info-meta">{{ ui.queryingIrsa }}</p>
        <div v-else-if="obsError" class="info-err">
          <p>{{ obsError }}</p>
          <p class="info-err-hint">{{ ui.irsaDownHint }}</p>
          <div class="info-err-actions">
            <button type="button" class="btn btn--gold" @click="retryObservations">{{ ui.retry }}</button>
            <button type="button" class="btn btn--ghost" @click="openStampsTab">{{ ui.openBlink }}</button>
          </div>
        </div>
        <p v-else-if="obsResult" class="info-meta">
          {{ obsResult.count }} {{ ui.spherexNear }}
          <template v-if="obsResult.observations?.[0]?.offline"> · {{ ui.localBackup }}</template>
        </p>

        <ul v-if="obsPreview.length" class="obs">
          <li v-for="(obs, idx) in obsPreview" :key="String(obs.obs_id ?? idx)">
            <p>{{ shortObsId(obs.obs_id) }}</p>
            <span>{{ bandLabel(obs.energy_bandpassname) }} · {{ mjdToHint(obs.t_min) }}</span>
            <div class="obs__row">
              <button type="button" class="mini mini--gold" title="Cutout real + metadatos" @click="openObsDetail(obs)">
                {{ ui.detail }}
              </button>
              <button type="button" class="mini" @click="useObsTarget(obs)">{{ ui.go }}</button>
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
          {{ ui.openBlinkArrow }}
        </button>
      </div>

      <div v-else class="panel__body stamps">
        <div class="motion-head" data-tour="motion">
          <p class="motion-head__name" :title="activeTarget?.highlight || ''">
            {{ activeTarget?.name || ui.motion }}
          </p>
          <p class="motion-head__hint">{{ ui.motionHint }}</p>
        </div>

        <div class="seg" role="tablist" :aria-label="ui.motionSource">
          <button
            type="button"
            class="seg__btn"
            :class="{ 'is-on': motionMode === 'spherex' }"
            role="tab"
            :aria-selected="motionMode === 'spherex'"
            @click="showSpherex"
          >
            SPHEREx
          </button>
          <button
            type="button"
            class="seg__btn"
            :class="{ 'is-on': motionMode === 'wise' }"
            role="tab"
            :aria-selected="motionMode === 'wise'"
            @click="showWiseCompare"
          >
            WISE
          </button>
        </div>

        <template v-if="motionMode === 'spherex'">
          <p v-if="playerRa == null || playerDec == null" class="info-err">{{ ui.noCoords }}</p>
          <div v-else class="motion-actions">
            <button
              type="button"
              class="action action--primary"
              :class="{ 'is-live': spherexFloatOpen }"
              title="Abre o trae el blink al frente"
              @click="openSpherexFloat"
            >
              {{ spherexFloatOpen ? ui.bringBlink : ui.openBlink }}
            </button>
            <button
              v-if="spherexFloatOpen"
              type="button"
              class="action action--soft"
              :title="ui.close"
              @click="spherexFloatOpen = false"
            >
              {{ ui.close }}
            </button>
          </div>
          <p v-if="spherexFloatOpen" class="motion-status">{{ ui.blinkFloating }}</p>
        </template>

        <template v-else>
        <div class="seg seg--sub" role="tablist" aria-label="Tipo WISE">
          <button
            type="button"
            class="seg__btn"
            :class="{ 'is-on': stampMode === 'epochs' }"
            @click="setStampMode('epochs')"
          >
            {{ ui.epochs }}
          </button>
          <button
            type="button"
            class="seg__btn"
            :class="{ 'is-on': stampMode === 'bands' }"
            @click="setStampMode('bands')"
          >
            {{ ui.bands }}
          </button>
        </div>

        <div class="blink-row">
          <button
            type="button"
            class="btn btn--gold"
            :disabled="stamps.length < 2"
            @click="toggleBlink"
          >
            {{ blinkOn ? 'Stop' : stampMode === 'epochs' ? ui.blinkMotion : ui.blinkBands }}
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

        <p v-if="stampLoading" class="info-meta">{{ ui.loadingEllipsis }}</p>
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

    <FloatingMotionWindow
      v-if="status === 'ready' && !isEmbed && playerRa != null && playerDec != null"
      :open="spherexFloatOpen"
      :tick="spherexFloatTick"
      :title="activeTarget?.name || 'SPHEREx'"
      :note="activeTarget?.highlight || ''"
      :object-type="activeTarget?.object_type || ''"
      :ra="playerRa"
      :dec="playerDec"
      :radius="motionRadius"
      :cutout-size="CUTOUT_SIZE_DEG"
      @close="spherexFloatOpen = false"
      @focus-sky="focusCutoutOnAtlas"
    />

    <SpherexDetailWindow
      v-if="status === 'ready' && !isEmbed"
      :open="detailOpen"
      :tick="detailTick"
      :obs="detailObs"
      :cutout-size="CUTOUT_SIZE_DEG"
      @close="detailOpen = false"
      @focus-sky="focusCutoutOnAtlas"
      @open-blink="openSpherexFloat"
      @open-external="openExternal"
    />

    <!-- Modo embed (?embed=1): solo atlas + reproductor compacto + enlace a la app -->
    <template v-if="status === 'ready' && isEmbed">
      <a class="embed-open" :href="fullAppUrl" target="_blank" rel="noopener noreferrer">
        {{ ui.openInApp }}
      </a>
      <div class="embed-player">
        <strong class="embed-player__title">{{ activeTarget?.name || ui.defaultTitle }}</strong>
        <img v-if="activeStamp" :src="activeStamp.jpegUrl" :alt="activeStamp.label" />
        <p v-else class="embed-player__meta">
          {{ stampLoading ? ui.loadingEpochs : stampError || ui.noEpochs }}
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
        <span>RA {{ liveRa }}°</span>
        <span>Dec {{ liveDec }}°</span>
        <span :class="backendOk ? 'ok' : 'bad'">{{ backendOk ? 'API ok' : 'API…' }}</span>
      </div>
      <div class="sky__bar-zoom">
        <button type="button" class="zoom-btn" :title="ui.zoomIn" @click="zoomBy(0.65)">+</button>
        <input v-model.number="zoomSlider" type="range" min="0" max="1000" />
        <button type="button" class="zoom-btn" :title="ui.zoomOut" @click="zoomBy(1.45)">−</button>
        <strong>{{ zoomLabel }}</strong>
      </div>
    </footer>

    <MissionGuidePanel
      v-if="!isEmbed"
      :open="guideOpen"
      :title="onboardingCopy.guideTitle"
      :lead="onboardingCopy.guideLead"
      :sections="onboardingCopy.guideSections"
      :glossary-title="onboardingCopy.glossaryTitle"
      :terms="onboardingCopy.terms"
      :restart-label="onboardingCopy.guideRestart"
      :close-label="onboardingCopy.guideClose"
      @close="closeGuide"
      @restart="startTour(0)"
    />

    <MissionOnboardingTour
      v-if="!isEmbed"
      :active="tourActive"
      :step-id="onboardingStepId"
      :step-index="onboardingStepIndex"
      :step-count="onboardingStepCount"
      :is-first="onboardingIsFirst"
      :is-last="onboardingIsLast"
      :target-rect="onboardingTargetRect"
      :title="tourStepCopy.title"
      :body="tourStepCopy.body"
      :skip-label="onboardingCopy.skip"
      :next-label="onboardingCopy.next"
      :back-label="onboardingCopy.back"
      :done-label="onboardingCopy.done"
      :progress-label="tourProgressLabel"
      @next="onboardingNext"
      @prev="onboardingPrev"
      @skip="skipTour"
      @remount="remountMeasure"
    />

    <div v-if="status === 'loading'" class="sky__overlay">{{ ui.loadingAtlas }}</div>
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
  margin-left: min(15.5rem, calc(100vw - 3rem));
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

.sky__actions :deep(.lang-toggle) {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(232, 196, 120, 0.45);
  background: rgba(8, 10, 16, 0.72);
  color: #f3efe4;
  padding: 0.45rem 0.7rem;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: none;
  white-space: nowrap;
}

.sky__actions :deep(.lang-toggle:hover),
.sky__actions :deep(.lang-toggle:focus-visible) {
  border-color: rgba(255, 220, 150, 0.9);
  background: rgba(232, 196, 120, 0.16);
  color: #fff4d4;
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
  animation: soft-pulse 2.4s ease-in-out infinite;
}

@keyframes soft-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(232, 196, 120, 0);
    border-color: rgba(232, 196, 120, 0.55);
  }
  50% {
    box-shadow: 0 0 0 3px rgba(232, 196, 120, 0.12), 0 0 18px rgba(232, 196, 120, 0.18);
    border-color: rgba(232, 196, 120, 0.95);
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn--on,
  .seg__btn.is-on,
  .action.is-live,
  .dest.is-on,
  .player__band.is-on,
  .tab.is-on {
    animation: none !important;
  }
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

.panel--catalog {
  width: min(14.5rem, calc(100vw - 2rem));
  bottom: auto;
  max-height: min(70vh, 28rem);
}

.panel__body--catalog {
  padding: 0.55rem;
  display: grid;
  gap: 0.35rem;
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
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  padding: 0.35rem 0.5rem;
  border-radius: 0.35rem;
  cursor: pointer;
}

.panel__x:hover {
  border-color: rgba(232, 196, 120, 0.5);
  color: #ffe9b8;
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
  animation: soft-pulse 2.6s ease-in-out infinite;
}

.dest-group {
  margin: 0.35rem 0 0.1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.45);
}

.dest {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  margin: 0;
  padding: 0.45rem 0.55rem;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  cursor: pointer;
}

.dest strong {
  font-size: 0.88rem;
  line-height: 1.2;
}

.dest span {
  font-size: 0.72rem;
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
  animation: soft-pulse 2.6s ease-in-out infinite;
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

.info-err p {
  margin: 0;
}

.info-err-hint {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.82rem;
  line-height: 1.4;
}

.info-err-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
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

.motion-head {
  margin: 0 0 0.75rem;
}

.motion-head__name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: #fff;
}

.motion-head__hint {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.55);
}

.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
  padding: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.55rem;
  background: rgba(0, 0, 0, 0.35);
}

.seg--sub {
  margin-top: 0.65rem;
}

.seg__btn {
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  padding: 0.55rem 0.4rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
}

.seg__btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.seg__btn.is-on {
  color: #ffe9b8;
  border-color: rgba(232, 196, 120, 0.55);
  background: rgba(232, 196, 120, 0.14);
  animation: soft-pulse 2.4s ease-in-out infinite;
}

.motion-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.action {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  padding: 0.65rem 0.75rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 0.45rem;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.action--primary {
  border-color: rgba(232, 196, 120, 0.65);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.12);
}

.action--primary.is-live {
  animation: soft-pulse 2.2s ease-in-out infinite;
}

.action--soft {
  min-width: 5.5rem;
  color: rgba(255, 255, 255, 0.75);
}

.action:hover {
  border-color: rgba(232, 196, 120, 0.55);
  color: #ffe9b8;
}

.motion-status {
  margin: 0.55rem 0 0;
  font-size: 0.75rem;
  color: rgba(255, 233, 184, 0.75);
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
  animation: soft-pulse 2.4s ease-in-out infinite;
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

.sky__bar-cta {
  padding: 0.4rem 0.65rem;
  font-size: 0.72rem;
  animation: soft-pulse 2.2s ease-in-out infinite;
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
