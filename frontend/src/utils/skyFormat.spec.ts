import { describe, expect, it } from 'vitest'
import { isValidDec, isValidRa, parseCoord } from './skyFormat'

const ARCSEC = 1 / 3600

/** Los 5 objetivos oficiales: grados (ICRS) ↔ sexagesimal. */
const OFFICIAL_TARGETS = [
  {
    id: 'barnard',
    ra: 269.452077,
    dec: 4.693365,
    raHms: ['17h57m48.498s', '17:57:48.498', '17 57 48.498'],
    decDms: ['+04d41m36.11s', '+04:41:36.11', '+04 41 36.11', '+4°41′36.11″'],
  },
  {
    id: 'eps_indi_b',
    ra: 331.044147,
    dec: -56.782844,
    raHms: ['22h04m10.595s', '22:04:10.595', '22 04 10.595'],
    decDms: ['-56d46m58.24s', '-56:46:58.24', '-56 46 58.24', '−56°46′58.24″'],
  },
  {
    id: 'wise0855',
    ra: 133.795129,
    dec: -7.245147,
    raHms: ['08h55m10.831s', '08:55:10.831', '08 55 10.831'],
    decDms: ['-7d14m42.53s', '-07:14:42.53', '-07 14 42.53', "-7°14'42.53\""],
  },
  {
    id: 'rw_aur',
    ra: 76.956526,
    dec: 30.401438,
    raHms: ['05h07m49.566s', '05:07:49.566', '05 07 49.566'],
    decDms: ['+30d24m05.18s', '+30:24:05.18', '30 24 05.18', '+30°24′05.18″'],
  },
  {
    id: 'r_dra',
    ra: 248.167611,
    dec: 66.754979,
    raHms: ['16h32m40.227s', '16:32:40.227', '16 32 40.227'],
    decDms: ['+66d45m17.93s', '+66:45:17.93', '66 45 17.93', '+66°45′17.93″'],
  },
]

describe('parseCoord · grados decimales', () => {
  it.each([
    ['268.34', 'ra', 268.34],
    ['268.34°', 'ra', 268.34],
    ['+3.58', 'dec', 3.58],
    ['3,58', 'dec', 3.58],
    ['-7.2451', 'dec', -7.2451],
    ['  133.7951  ', 'ra', 133.7951],
    ['0', 'ra', 0],
    ['.5', 'dec', 0.5],
  ] as const)('%s (%s) → %d', (raw, axis, expected) => {
    expect(parseCoord(raw, axis)).toBeCloseTo(expected, 9)
  })

  it('el decimal es grados también en RA (no horas)', () => {
    expect(parseCoord('8.5', 'ra')).toBe(8.5)
  })
})

describe('parseCoord · objetivos oficiales en grados y sexagesimal', () => {
  for (const t of OFFICIAL_TARGETS) {
    it(`${t.id}: grados`, () => {
      expect(parseCoord(String(t.ra), 'ra')).toBeCloseTo(t.ra, 9)
      expect(parseCoord(String(t.dec), 'dec')).toBeCloseTo(t.dec, 9)
    })

    it.each(t.raHms)(`${t.id}: RA %s ≈ grados (< 1″)`, (raw) => {
      const ra = parseCoord(raw, 'ra')
      expect(ra).not.toBeNull()
      expect(Math.abs((ra as number) - t.ra)).toBeLessThan(ARCSEC)
    })

    it.each(t.decDms)(`${t.id}: Dec %s ≈ grados (< 1″)`, (raw) => {
      const dec = parseCoord(raw, 'dec')
      expect(dec).not.toBeNull()
      expect(Math.abs((dec as number) - t.dec)).toBeLessThan(ARCSEC)
    })
  }
})

describe('parseCoord · reglas sexagesimales', () => {
  it('el signo se aplica al total (-00:30:00 → −0.5)', () => {
    expect(parseCoord('-00:30:00', 'dec')).toBeCloseTo(-0.5, 12)
    expect(parseCoord('-0d30m', 'dec')).toBeCloseTo(-0.5, 12)
  })

  it('el marcador decide la unidad', () => {
    expect(parseCoord('8h', 'ra')).toBeCloseTo(120, 12)
    expect(parseCoord('8.5h', 'ra')).toBeCloseTo(127.5, 12)
    expect(parseCoord('133d47m42.5s', 'ra')).toBeCloseTo(133 + 47 / 60 + 42.5 / 3600, 12)
    expect(parseCoord('08h55.5m', 'ra')).toBeCloseTo((8 + 55.5 / 60) * 15, 12)
  })

  it('acepta mayúsculas y sin unidad final', () => {
    expect(parseCoord('08H55M10.831S', 'ra')).toBeCloseTo(133.795129, 5)
    expect(parseCoord('08h55m10.831', 'ra')).toBeCloseTo(133.795129, 5)
  })
})

describe('parseCoord · inválidos', () => {
  it.each([
    ['abc', 'ra'],
    ['', 'ra'],
    ['   ', 'dec'],
    ['12h75m', 'ra'],
    ['10:61:00', 'dec'],
    ['10:00:60', 'dec'],
    ['25h', 'ra'],
    ['24:00:00', 'ra'],
    ['1:2:3:4', 'ra'],
    ['--5', 'dec'],
    ['+-5', 'dec'],
    ['5d-3m', 'dec'],
    ['08h55m10s', 'dec'],
    ['8:', 'ra'],
    ['10s', 'ra'],
    ['08.5h55m', 'ra'],
    ['08h 55 10', 'ra'],
    ['1e2', 'ra'],
    ['1,234.5', 'ra'],
  ] as const)('%j (%s) → null', (raw, axis) => {
    expect(parseCoord(raw, axis)).toBeNull()
  })

  it('null / undefined → null', () => {
    expect(parseCoord(null, 'ra')).toBeNull()
    expect(parseCoord(undefined, 'dec')).toBeNull()
  })
})

describe('isValidRa / isValidDec', () => {
  it('RA en [0, 360)', () => {
    expect(isValidRa(0)).toBe(true)
    expect(isValidRa(359.99999)).toBe(true)
    expect(isValidRa(360)).toBe(false)
    expect(isValidRa(-0.1)).toBe(false)
    expect(isValidRa(999)).toBe(false)
    expect(isValidRa(Number.NaN)).toBe(false)
    expect(isValidRa(null)).toBe(false)
  })

  it('Dec en [−90, 90]', () => {
    expect(isValidDec(-90)).toBe(true)
    expect(isValidDec(90)).toBe(true)
    expect(isValidDec(90.0001)).toBe(false)
    expect(isValidDec(-91)).toBe(false)
    expect(isValidDec(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
