import { describe, expect, it } from 'vitest'
import type { LocationQuery } from 'vue-router'
import { readFromQuery } from '@/composables/useSkyUrlState'
import { SKY_CATALOG, type CatalogEntry } from '@/data/skyCatalog'
import { missionQuery, resolveCoords } from './catalogLink'

const ARCMIN = 1 / 60
const FIXED_DATE = new Date('2026-11-15T00:00:00Z')

/**
 * JPL Horizons, Júpiter (599) geocéntrico (500@399), RA/Dec astrométricas ICRF,
 * 2026-11-15 00:00 UT.
 */
const HORIZONS_JUPITER = { ra: 147.929503893, dec: 13.74800681 }

function separationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const rad = Math.PI / 180
  const dRa = (ra2 - ra1) * rad
  const dDec = (dec2 - dec1) * rad
  const h =
    Math.sin(dDec / 2) ** 2 + Math.cos(dec1 * rad) * Math.cos(dec2 * rad) * Math.sin(dRa / 2) ** 2
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / rad
}

function entry(id: string): CatalogEntry {
  const found = SKY_CATALOG.find((e) => e.id === id)
  if (!found) throw new Error(`falta la entrada ${id}`)
  return found
}

describe('resolveCoords', () => {
  it('con coordenadas fijas devuelve los valores tal cual', () => {
    expect(resolveCoords({ kind: 'fixed', ra: 83.8221, dec: -5.3911, fov: 1 })).toEqual({
      ra: 83.8221,
      dec: -5.3911,
      fov: 1,
    })
  })

  it('Júpiter en una fecha fija coincide con JPL Horizons (< 1′)', () => {
    const { ra, dec, fov } = resolveCoords({ kind: 'ephemeris', body: 'Jupiter', fov: 0.5 }, FIXED_DATE)
    expect(fov).toBe(0.5)
    const sep = separationDeg(ra, dec, HORIZONS_JUPITER.ra, HORIZONS_JUPITER.dec)
    expect(sep).toBeLessThan(ARCMIN)
  })

  it('Júpiter cambia de posición con la fecha', () => {
    const link = { kind: 'ephemeris', body: 'Jupiter', fov: 0.5 } as const
    const a = resolveCoords(link, FIXED_DATE)
    const b = resolveCoords(link, new Date('2026-12-15T00:00:00Z'))
    expect(separationDeg(a.ra, a.dec, b.ra, b.dec)).toBeGreaterThan(ARCMIN)
  })
})

describe('missionQuery', () => {
  it.each(SKY_CATALOG.map((e) => e.id))('%s produce una query que readFromQuery acepta', (id) => {
    const item = entry(id)
    const route = missionQuery(item, FIXED_DATE)
    expect(route).not.toBeNull()
    expect(route?.name).toBe('mission')
    expect(route?.query.target).toBeUndefined()

    const parsed = readFromQuery(route?.query as LocationQuery)
    expect(parsed.invalid).toEqual([])
    expect(parsed.state.target).toBeNull()

    const expected = resolveCoords(item.missionLink, FIXED_DATE)
    expect(parsed.state.ra).toBeCloseTo(expected.ra, 4)
    expect(parsed.state.dec).toBeCloseTo(expected.dec, 4)
    expect(parsed.state.fov).toBeCloseTo(expected.fov, 3)
  })

  it('las coordenadas fijas llegan centradas en M42, M57 y M31', () => {
    expect(missionQuery(entry('emission'))?.query).toEqual({ ra: '83.8221', dec: '-5.3911', fov: '1' })
    expect(missionQuery(entry('planetary'))?.query).toEqual({ ra: '283.3963', dec: '33.0292', fov: '0.15' })
    expect(missionQuery(entry('galaxy'))?.query).toEqual({ ra: '10.6847', dec: '41.269', fov: '3' })
  })

  it('devuelve null si las coordenadas son inválidas', () => {
    const broken: CatalogEntry = { ...entry('emission'), missionLink: { kind: 'fixed', ra: 400, dec: 0, fov: 1 } }
    expect(missionQuery(broken)).toBeNull()
    const badDec: CatalogEntry = { ...entry('emission'), missionLink: { kind: 'fixed', ra: 10, dec: 95, fov: 1 } }
    expect(missionQuery(badDec)).toBeNull()
    const badFov: CatalogEntry = { ...entry('emission'), missionLink: { kind: 'fixed', ra: 10, dec: 0, fov: 0 } }
    expect(missionQuery(badFov)).toBeNull()
  })
})
