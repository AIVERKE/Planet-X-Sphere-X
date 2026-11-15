/**
 * Estado de la vista del atlas en la URL (`/mision?ra=&dec=&fov=&target=&embed=`).
 *
 * - `readFromQuery`: parsea y valida la query (función pura).
 * - `buildQuery`: query canónica a partir de la vista (redondeo + params ajenos intactos).
 * - `createQueryWriter`: escritura con debounce sobre `router.replace` (o `push` puntual),
 *   sin escrituras redundantes y recordando las propias para no re-aplicarlas.
 */

import { onUnmounted } from 'vue'
import {
  useRoute,
  useRouter,
  type LocationQuery,
  type LocationQueryRaw,
  type LocationQueryValue,
  type RouteLocationNormalizedLoaded,
  type Router,
} from 'vue-router'
import { presetById } from '@/data/presetFallback'
import { isValidDec, isValidRa, parseCoord } from '@/utils/skyFormat'

/**
 * Mínimo del atlas. ~0.028° ≈ 100″.
 * PanSTARRS trae 0.25″ por píxel: más cerca solo estira esos píxeles en bloques.
 */
export const FOV_MIN = 0.028
export const FOV_MAX = 40
/** Aviso suave: por debajo el cielo óptico ya no gana detalle. */
export const FOV_SOFT_LIMIT = 0.35
/** FOV cómodo para nebulosas / campos anchos (sigue cargando tiles HD). */
export const FOV_NEBULA = 1.2
export const URL_WRITE_DELAY_MS = 400
/** Tiempo máximo para que el router refleje una escritura propia. */
const OWN_WRITE_TTL_MS = 2000

export type SkyUrlParam = 'ra' | 'dec' | 'fov' | 'target'

export type SkyUrlState = {
  ra: number | null
  dec: number | null
  fov: number | null
  target: string | null
  embed: boolean
}

export type SkyUrlParseResult = {
  state: SkyUrlState
  /** Parámetros presentes pero inválidos (se ignoraron). */
  invalid: SkyUrlParam[]
  /** Valor crudo de `target`, para el aviso al usuario. */
  rawTarget: string | null
}

/** Lo que la vista escribe en la URL. */
export type SkyViewState = {
  ra: number
  dec: number
  fov: number
  target: string | null
}

export type QueryHistoryMode = 'push' | 'replace'

const OWN_KEYS = new Set(['ra', 'dec', 'fov', 'target'])

type RawQueryValue = LocationQueryValue | LocationQueryValue[] | undefined

function firstValue(value: RawQueryValue): string | null {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed ? trimmed : null
}

export function clampFov(fov: number): number {
  return Math.min(FOV_MAX, Math.max(FOV_MIN, fov))
}

export function readFromQuery(query: LocationQuery): SkyUrlParseResult {
  const invalid: SkyUrlParam[] = []
  const state: SkyUrlState = { ra: null, dec: null, fov: null, target: null, embed: false }

  const rawRa = firstValue(query.ra)
  const rawDec = firstValue(query.dec)
  if (rawRa != null || rawDec != null) {
    const ra = parseCoord(rawRa, 'ra')
    const dec = parseCoord(rawDec, 'dec')
    // Solo tienen sentido como par: si uno falla se descartan ambos.
    if (isValidRa(ra) && isValidDec(dec)) {
      state.ra = ra
      state.dec = dec
    } else {
      invalid.push('ra', 'dec')
    }
  }

  const rawFov = firstValue(query.fov)
  if (rawFov != null) {
    const fov = Number(rawFov.replace(',', '.'))
    if (Number.isFinite(fov) && fov > 0) state.fov = clampFov(fov)
    else invalid.push('fov')
  }

  const rawTarget = firstValue(query.target)
  if (rawTarget != null) {
    const preset = presetById(rawTarget)
    if (preset) state.target = preset.id
    else invalid.push('target')
  }

  const embed = firstValue(query.embed)
  state.embed = embed === '1' || embed === 'true'

  return { state, invalid, rawTarget }
}

/** Aviso legible para parámetros inválidos, o `null` si no hay nada que avisar. */
export function describeInvalidQuery(
  result: SkyUrlParseResult,
  options: { live?: boolean } = {},
): string | null {
  const { invalid, state, rawTarget } = result
  if (!invalid.length) return null

  const issues: string[] = []
  if (invalid.includes('ra')) issues.push('coordenadas inválidas')
  if (invalid.includes('target')) issues.push(`objetivo «${rawTarget ?? ''}» inexistente`)
  if (invalid.includes('fov')) issues.push('FOV inválido')

  let outcome: string
  if (state.ra != null) {
    outcome = 'se ignoraron esos parámetros'
  } else if (state.target) {
    const name = presetById(state.target)?.name ?? state.target
    outcome = `se centró en ${name}`
  } else {
    outcome = options.live ? 'se mantuvo la vista actual' : 'se cargó la vista por defecto'
  }

  const text = `${issues.join(', ')} en la URL, ${outcome}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function trimNumber(value: number, digits: number): string {
  const fixed = value.toFixed(digits)
  return String(Number(fixed))
}

function normalizeRa(ra: number): number {
  const wrapped = ((ra % 360) + 360) % 360
  // 359.999999 redondeado a 5 decimales sería 360 → 0.
  return Number(wrapped.toFixed(5)) >= 360 ? 0 : wrapped
}

/**
 * Query canónica de la vista: RA/Dec a 5 decimales (~0.04″), FOV a 3.
 * Conserva parámetros ajenos (`embed`, `utm_*`…) y quita `target` si no hay objetivo.
 */
export function buildQuery(view: SkyViewState, current: LocationQuery = {}): LocationQueryRaw {
  const next: LocationQueryRaw = {}
  if (view.target) next.target = view.target
  next.ra = trimNumber(normalizeRa(view.ra), 5)
  next.dec = trimNumber(Math.min(90, Math.max(-90, view.dec)), 5)
  next.fov = trimNumber(clampFov(view.fov), 3)
  for (const [key, value] of Object.entries(current)) {
    if (!OWN_KEYS.has(key)) next[key] = value
  }
  return next
}

/** Clave estable (independiente del orden) para comparar queries. */
export function queryKey(query: LocationQuery | LocationQueryRaw): string {
  const asText = (x: unknown) => (x == null ? null : String(x))
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, Array.isArray(v) ? v.map(asText) : asText(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return JSON.stringify(entries)
}

export type QueryRouter = Pick<Router, 'push' | 'replace'>
export type QueryLocation = Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'hash'>

export type QueryWriterOptions = {
  delayMs?: number
  /** Si devuelve false no se escribe (p. ej. ya se navegó fuera de la vista). */
  canWrite?: () => boolean
}

export function createQueryWriter(
  router: QueryRouter,
  getLocation: () => QueryLocation,
  { delayMs = URL_WRITE_DELAY_MS, canWrite = () => true }: QueryWriterOptions = {},
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: SkyViewState | null = null
  /**
   * Escrituras propias aún no observadas. Cada una se consume la primera vez que llega su
   * cambio de ruta: así una navegación Atrás hacia una query que escribimos antes NO se
   * confunde con una escritura propia.
   */
  let unacknowledged: { key: string; at: number }[] = []

  function prune(now: number) {
    unacknowledged = unacknowledged.filter((w) => now - w.at < OWN_WRITE_TTL_MS)
  }

  function forget(key: string) {
    const index = unacknowledged.findIndex((w) => w.key === key)
    if (index >= 0) unacknowledged.splice(index, 1)
  }

  async function write(view: SkyViewState, mode: QueryHistoryMode): Promise<void> {
    if (!canWrite()) return
    const location = getLocation()
    const next = buildQuery(view, location.query)
    const key = queryKey(next)
    if (key === queryKey(location.query)) return
    const now = Date.now()
    prune(now)
    unacknowledged.push({ key, at: now })
    const target = { path: location.path, query: next, hash: location.hash }
    try {
      const failure = await (mode === 'push' ? router.push(target) : router.replace(target))
      if (failure) forget(key) // navegación abortada/cancelada: no llegará ningún cambio
    } catch {
      forget(key)
    }
  }

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    pending = null
  }

  /** Programa un `replace` con debounce (la última vista gana). */
  function schedule(view: SkyViewState) {
    pending = view
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const latest = pending
      pending = null
      if (latest) void write(latest, 'replace')
    }, delayMs)
  }

  /** Escribe ya lo que esté pendiente (p. ej. antes de copiar el enlace). */
  function flush(): Promise<void> {
    const latest = pending
    cancel()
    return latest ? write(latest, 'replace') : Promise.resolve()
  }

  /** Escritura inmediata; descarta lo pendiente. */
  function commit(view: SkyViewState, mode: QueryHistoryMode = 'replace'): Promise<void> {
    cancel()
    return write(view, mode)
  }

  /** ¿Este cambio de ruta es el eco de una escritura propia? (la consume si lo es) */
  function isOwn(query: LocationQuery): boolean {
    prune(Date.now())
    const key = queryKey(query)
    const own = unacknowledged.some((w) => w.key === key)
    if (own) forget(key)
    return own
  }

  return { schedule, flush, commit, cancel, isOwn }
}

export function useSkyUrlState() {
  const router = useRouter()
  const route = useRoute()
  const routeName = route.name
  const writer = createQueryWriter(router, () => route, {
    canWrite: () => route.name === routeName,
  })
  onUnmounted(writer.cancel)

  return {
    writeToQuery: writer.schedule,
    commitToQuery: writer.commit,
    flushQueryWrite: writer.flush,
    cancelQueryWrite: writer.cancel,
    isOwnQuery: writer.isOwn,
  }
}
