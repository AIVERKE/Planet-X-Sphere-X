/** Formato amigable de coords / metadatos ObsCore (vs. UI técnica tipo WiseView). */

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

export function hostFromUrl(url: unknown): string {
  if (typeof url !== 'string' || !url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'enlace'
  }
}
