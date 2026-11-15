/** Formato amigable de coords / metadatos ObsCore (vs. UI técnica tipo WiseView). */

export type CoordAxis = 'ra' | 'dec'

type SexagesimalPart = { value: string; mark: string }

const DECIMAL_RE = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/
const MINUTE_MARKS = new Set(['m', '′', "'"])
const SECOND_MARKS = new Set(['s', '″', '"'])

/**
 * Parsea una coordenada en grados decimales o en sexagesimal.
 *
 * - Decimal (siempre grados): `268.34`, `268.34°`, `+3.58`, `3,58`.
 * - Sexagesimal: `08h55m10.8s`, `08:55:10.8`, `08 55 10.8`, `-7d14m42.5s`, `-07:14:42.5`,
 *   `-7°14′42.5″`. El marcador decide la unidad (`h` → horas, `d`/`°` → grados); con `:` o
 *   espacios se usa la convención del eje (RA en horas, Dec en grados).
 *
 * No valida rangos: usar `isValidRa` / `isValidDec`.
 */
export function parseCoord(raw: unknown, axis: CoordAxis): number | null {
  if (raw == null) return null
  let s = String(raw)
    .trim()
    .replace(/[−‒–—]/g, '-')
    .replace(/º/g, '°')
    .replace(/''/g, '"')
    .toLowerCase()
  if (!s) return null

  let sign = 1
  if (s[0] === '+' || s[0] === '-') {
    if (s[0] === '-') sign = -1
    s = s.slice(1).trim()
  }
  if (!s) return null

  const decimal = s.replace(/°$/, '').trim()
  if (DECIMAL_RE.test(decimal)) {
    const n = Number(decimal.replace(',', '.'))
    return Number.isFinite(n) ? sign * n : null
  }

  return parseSexagesimal(s, axis, sign)
}

function splitSexagesimal(s: string): SexagesimalPart[] | null {
  const component = /(\d+(?:\.\d+)?|\.\d+)\s*([hd°m′'s″":]?)\s*/y
  const parts: SexagesimalPart[] = []
  while (component.lastIndex < s.length) {
    const start = component.lastIndex
    const match = component.exec(s)
    if (!match || component.lastIndex === start) return null
    parts.push({ value: match[1] ?? '', mark: match[2] ?? '' })
    if (parts.length > 3) return null
  }
  return parts
}

function parseSexagesimal(s: string, axis: CoordAxis, sign: number): number | null {
  const parts = splitSexagesimal(s)
  if (!parts?.length) return null

  const head = parts[0]?.mark ?? ''
  let style: 'unit' | 'colon' | 'space'
  let unit: 'hours' | 'degrees' = axis === 'ra' ? 'hours' : 'degrees'
  if (head === 'h') {
    style = 'unit'
    unit = 'hours'
  } else if (head === 'd' || head === '°') {
    style = 'unit'
    unit = 'degrees'
  } else if (head === ':' && parts.length > 1) {
    style = 'colon'
  } else if (head === '' && parts.length > 1) {
    style = 'space'
  } else {
    return null
  }
  if (unit === 'hours' && axis === 'dec') return null

  for (let i = 1; i < parts.length; i++) {
    const mark = parts[i]?.mark ?? ''
    const last = i === parts.length - 1
    let ok: boolean
    if (style === 'unit') {
      const marks = i === 1 ? MINUTE_MARKS : SECOND_MARKS
      ok = marks.has(mark) || (last && mark === '')
    } else if (style === 'colon') {
      ok = last ? mark === '' : mark === ':'
    } else {
      ok = mark === ''
    }
    if (!ok) return null
  }

  // Solo el último componente puede llevar decimales (08h55.5m sí; 08.5h55m no).
  if (parts.slice(0, -1).some((p) => p.value.includes('.'))) return null

  const nums = parts.map((p) => Number(p.value))
  if (nums.some((n) => !Number.isFinite(n))) return null
  if (nums.slice(1).some((n) => n >= 60)) return null

  const [a = 0, b = 0, c = 0] = nums
  const total = a + b / 60 + c / 3600
  if (unit === 'hours' && total >= 24) return null
  return sign * (unit === 'hours' ? total * 15 : total)
}

/** AR válida en grados ICRS: 0 ≤ ra < 360 (mismo criterio que el backend). */
export function isValidRa(ra: number | null | undefined): ra is number {
  return typeof ra === 'number' && Number.isFinite(ra) && ra >= 0 && ra < 360
}

/** Dec válida en grados ICRS: −90 ≤ dec ≤ 90. */
export function isValidDec(dec: number | null | undefined): dec is number {
  return typeof dec === 'number' && Number.isFinite(dec) && dec >= -90 && dec <= 90
}

export function formatRaDec(ra: number, dec: number, digits = 5): string {
  const sign = dec >= 0 ? '+' : ''
  return `${ra.toFixed(digits)}°  ${sign}${dec.toFixed(digits)}°`
}

export function shortObsId(obsId: unknown): string {
  const raw = String(obsId ?? 'sin-id')
  if (raw.length <= 22) return raw
  return `${raw.slice(0, 10)}…${raw.slice(-8)}`
}

export function bandLabel(band: unknown): string {
  const b = String(band ?? '')
  if (!b) return 'Banda —'
  return b.replace(/^SPHEREx-/, 'Detector ')
}

export function mjdToHint(mjd: unknown): string {
  const n = Number(mjd)
  if (!Number.isFinite(n)) return 'época —'
  // Conversión aproximada MJD → año civil (suficiente para UI).
  const year = 1858.678 + n / 365.25
  return `~${year.toFixed(1)}`
}

/** MJD → fecha UTC (MJD 0 = 1858-11-17). */
export function mjdToIso(mjd: unknown): string {
  const n = Number(mjd)
  if (!Number.isFinite(n)) return 'fecha —'
  const ms = Date.UTC(1858, 10, 17) + n * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

export function hostFromUrl(url: unknown): string {
  if (typeof url !== 'string' || !url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'enlace'
  }
}
