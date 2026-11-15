import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocationQuery } from 'vue-router'
import { skyTargetById } from '@/data/skyTargets'
import {
  FOV_MAX,
  FOV_MIN,
  buildQuery,
  createQueryWriter,
  describeInvalidQuery,
  queryKey,
  readFromQuery,
  type QueryLocation,
  type QueryRouter,
} from './useSkyUrlState'

const ARCSEC = 1 / 3600

describe('readFromQuery', () => {
  it('lee ra/dec/fov decimales (WISE 0855)', () => {
    const { state, invalid } = readFromQuery({ ra: '133.7951', dec: '-7.2451', fov: '0.3' })
    expect(invalid).toEqual([])
    expect(state).toEqual({ ra: 133.7951, dec: -7.2451, fov: 0.3, target: null, embed: false })
  })

  it('sexagesimal produce la misma vista que el decimal (< 1″)', () => {
    const dec = readFromQuery({ ra: '133.7951', dec: '-7.2451' }).state
    const sex = readFromQuery({ ra: '08h55m10.831s', dec: '-7d14m42.53s' }).state
    expect(Math.abs((sex.ra as number) - (dec.ra as number))).toBeLessThan(ARCSEC)
    expect(Math.abs((sex.dec as number) - (dec.dec as number))).toBeLessThan(ARCSEC)
  })

  it('acepta los formatos con dos puntos', () => {
    const { state, invalid } = readFromQuery({ ra: '08:55:10.8', dec: '-07:14:42.5' })
    expect(invalid).toEqual([])
    expect(state.ra).toBeCloseTo(133.795, 3)
    expect(state.dec).toBeCloseTo(-7.2451, 3)
  })

  it.each(['barnard', 'eps_indi_b', 'wise0855', 'rw_aur', 'r_dra'])(
    'resuelve el preset oficial target=%s',
    (id) => {
      const { state, invalid } = readFromQuery({ target: id })
      expect(invalid).toEqual([])
      expect(state.target).toBe(id)
      expect(skyTargetById(id)).toBeDefined()
    },
  )

  it('target no distingue mayúsculas', () => {
    expect(readFromQuery({ target: 'Barnard' }).state.target).toBe('barnard')
  })

  it('ra=999&dec=abc → coordenadas nulas y marcadas como inválidas', () => {
    const result = readFromQuery({ ra: '999', dec: 'abc' })
    expect(result.state.ra).toBeNull()
    expect(result.state.dec).toBeNull()
    expect(result.invalid).toEqual(['ra', 'dec'])
    expect(describeInvalidQuery(result)).toBe(
      'Coordenadas inválidas en la URL, se cargó la vista por defecto',
    )
  })

  it('solo ra (sin dec) es inválido: van en par', () => {
    const { state, invalid } = readFromQuery({ ra: '133.7951' })
    expect(state.ra).toBeNull()
    expect(invalid).toEqual(['ra', 'dec'])
  })

  it('ra fuera de rango (360, -1) es inválido', () => {
    expect(readFromQuery({ ra: '360', dec: '0' }).invalid).toEqual(['ra', 'dec'])
    expect(readFromQuery({ ra: '-1', dec: '0' }).invalid).toEqual(['ra', 'dec'])
    expect(readFromQuery({ ra: '10', dec: '91' }).invalid).toEqual(['ra', 'dec'])
  })

  it('acota el FOV a [FOV_MIN, FOV_MAX]', () => {
    expect(readFromQuery({ fov: '0.001' }).state.fov).toBe(FOV_MIN)
    expect(readFromQuery({ fov: '999' }).state.fov).toBe(FOV_MAX)
    expect(readFromQuery({ fov: '0.5' }).state.fov).toBe(0.5)
  })

  it('FOV no numérico, cero o negativo → inválido', () => {
    for (const fov of ['abc', '0', '-2']) {
      const { state, invalid } = readFromQuery({ fov })
      expect(state.fov).toBeNull()
      expect(invalid).toEqual(['fov'])
    }
  })

  it('target inexistente → inválido con aviso', () => {
    const result = readFromQuery({ target: 'planeta-x' })
    expect(result.state.target).toBeNull()
    expect(result.invalid).toEqual(['target'])
    expect(describeInvalidQuery(result)).toBe(
      'Objetivo «planeta-x» inexistente en la URL, se cargó la vista por defecto',
    )
  })

  it('coords inválidas con target válido → el aviso indica el objetivo usado', () => {
    const result = readFromQuery({ ra: 'abc', dec: '1', target: 'barnard' })
    expect(result.state.target).toBe('barnard')
    expect(describeInvalidQuery(result)).toBe(
      'Coordenadas inválidas en la URL, se centró en Estrella de Barnard',
    )
  })

  it('con la página abierta, el aviso dice que se mantuvo la vista', () => {
    const result = readFromQuery({ ra: '999', dec: 'abc' })
    expect(describeInvalidQuery(result, { live: true })).toBe(
      'Coordenadas inválidas en la URL, se mantuvo la vista actual',
    )
  })

  it('sin parámetros no hay aviso ni valores', () => {
    const result = readFromQuery({})
    expect(result.invalid).toEqual([])
    expect(describeInvalidQuery(result)).toBeNull()
    expect(result.state).toEqual({ ra: null, dec: null, fov: null, target: null, embed: false })
  })

  it('valores vacíos se tratan como ausentes', () => {
    expect(readFromQuery({ ra: '', dec: '', fov: '' }).invalid).toEqual([])
  })

  it('embed=1 / embed=true activan el modo compacto', () => {
    expect(readFromQuery({ embed: '1' }).state.embed).toBe(true)
    expect(readFromQuery({ embed: 'true' }).state.embed).toBe(true)
    expect(readFromQuery({ embed: '0' }).state.embed).toBe(false)
  })

  it('parámetros repetidos: se usa el primer valor', () => {
    const query: LocationQuery = { ra: ['10', '20'], dec: ['5', '6'], target: ['crab', 'orion'] }
    const { state } = readFromQuery(query)
    expect(state.ra).toBe(10)
    expect(state.dec).toBe(5)
    expect(state.target).toBe('crab')
  })
})

describe('buildQuery', () => {
  it('redondea RA/Dec a 5 decimales y FOV a 3', () => {
    const q = buildQuery({ ra: 133.795129166, dec: -7.245147222, fov: 0.30049, target: 'wise0855' })
    expect(q).toEqual({ target: 'wise0855', ra: '133.79513', dec: '-7.24515', fov: '0.3' })
  })

  it('conserva parámetros ajenos (embed, utm…) y sustituye los propios', () => {
    const q = buildQuery(
      { ra: 10, dec: 20, fov: 1, target: null },
      { embed: '1', utm_source: 'x', ra: '1', target: 'crab' },
    )
    expect(q).toEqual({ ra: '10', dec: '20', fov: '1', embed: '1', utm_source: 'x' })
  })

  it('normaliza RA a [0, 360) y acota Dec y FOV', () => {
    expect(buildQuery({ ra: -10, dec: 95, fov: 100, target: null })).toEqual({
      ra: '350',
      dec: '90',
      fov: String(FOV_MAX),
    })
    expect(buildQuery({ ra: 359.999999, dec: 0, fov: 0.01, target: null })).toEqual({
      ra: '0',
      dec: '0',
      fov: String(FOV_MIN),
    })
  })

  it('ida y vuelta: lo escrito se vuelve a leer igual', () => {
    const view = { ra: 269.452077, dec: 4.693365, fov: 0.3, target: 'barnard' }
    const back = readFromQuery(buildQuery(view) as LocationQuery).state
    expect(back.target).toBe('barnard')
    expect(Math.abs((back.ra as number) - view.ra)).toBeLessThan(ARCSEC)
    expect(Math.abs((back.dec as number) - view.dec)).toBeLessThan(ARCSEC)
    expect(back.fov).toBe(0.3)
  })
})

describe('queryKey', () => {
  it('no depende del orden de las claves', () => {
    expect(queryKey({ a: '1', b: '2' })).toBe(queryKey({ b: '2', a: '1' }))
    expect(queryKey({ a: '1' })).not.toBe(queryKey({ a: '2' }))
  })
})

describe('createQueryWriter', () => {
  let location: QueryLocation
  let router: { push: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> }

  function navigate(to: { path: string; query: LocationQuery; hash: string }) {
    location = { path: to.path, query: to.query, hash: to.hash }
    return Promise.resolve()
  }

  function makeWriter(canWrite = () => true) {
    return createQueryWriter(router as unknown as QueryRouter, () => location, {
      delayMs: 400,
      canWrite,
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    location = { path: '/mission', query: { embed: '1' }, hash: '' }
    router = { push: vi.fn(navigate), replace: vi.fn(navigate) }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('agrupa varias vistas en una sola replace tras el debounce', async () => {
    const writer = makeWriter()
    writer.schedule({ ra: 1, dec: 1, fov: 1, target: null })
    writer.schedule({ ra: 2, dec: 2, fov: 1, target: null })
    writer.schedule({ ra: 3, dec: 3, fov: 1, target: null })
    expect(router.replace).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(399)
    expect(router.replace).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(router.replace).toHaveBeenCalledTimes(1)
    expect(router.push).not.toHaveBeenCalled()
    // Conserva la ruta actual (alias /mission) y los params ajenos.
    expect(router.replace.mock.calls[0]?.[0]).toEqual({
      path: '/mission',
      query: { ra: '3', dec: '3', fov: '1', embed: '1' },
      hash: '',
    })
  })

  it('no escribe si la query resultante ya es la actual', async () => {
    location.query = { ra: '3', dec: '3', fov: '1', embed: '1' }
    const writer = makeWriter()
    writer.schedule({ ra: 3.000001, dec: 3, fov: 1, target: null })
    await vi.advanceTimersByTimeAsync(400)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('commit("push") escribe al momento con push y descarta lo pendiente', async () => {
    const writer = makeWriter()
    writer.schedule({ ra: 1, dec: 1, fov: 1, target: null })
    await writer.commit({ ra: 269.452077, dec: 4.693365, fov: 0.3, target: 'barnard' }, 'push')
    await vi.advanceTimersByTimeAsync(1000)

    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
    expect(location.query).toEqual({
      target: 'barnard',
      ra: '269.45208',
      dec: '4.69337',
      fov: '0.3',
      embed: '1',
    })
  })

  it('flush escribe lo pendiente sin esperar el debounce', async () => {
    const writer = makeWriter()
    writer.schedule({ ra: 5, dec: 5, fov: 2, target: null })
    await writer.flush()
    expect(router.replace).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it('isOwn reconoce el eco de una escritura propia una sola vez', async () => {
    const writer = makeWriter()
    await writer.commit({ ra: 7, dec: 7, fov: 1, target: null })
    const written = location.query
    expect(writer.isOwn({ ra: '8', dec: '8' })).toBe(false)
    expect(writer.isOwn(written)).toBe(true)
    // Volver más tarde (Atrás) a esa misma query ya no es una escritura propia.
    expect(writer.isOwn(written)).toBe(false)
  })

  it('Atrás hacia una query escrita antes se trata como externa', async () => {
    const writer = makeWriter()
    await writer.commit({ ra: 83.6331, dec: 22.0145, fov: 0.35, target: 'crab' }, 'push')
    const crab = location.query
    expect(writer.isOwn(crab)).toBe(true) // eco del push
    await writer.commit({ ra: 83.8221, dec: -5.3911, fov: 1.8, target: 'orion' }, 'push')
    expect(writer.isOwn(location.query)).toBe(true) // eco del push
    expect(writer.isOwn(crab)).toBe(false) // popstate → hay que aplicarla
  })

  it('una escritura propia no reconocida caduca', async () => {
    const writer = makeWriter()
    await writer.commit({ ra: 9, dec: 9, fov: 1, target: null })
    const written = location.query
    await vi.advanceTimersByTimeAsync(2500)
    expect(writer.isOwn(written)).toBe(false)
  })

  it('cancel descarta la escritura pendiente', async () => {
    const writer = makeWriter()
    writer.schedule({ ra: 1, dec: 1, fov: 1, target: null })
    writer.cancel()
    await vi.advanceTimersByTimeAsync(1000)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('no escribe si canWrite() es false (ya se salió de la vista)', async () => {
    const writer = makeWriter(() => false)
    writer.schedule({ ra: 1, dec: 1, fov: 1, target: null })
    await vi.advanceTimersByTimeAsync(400)
    expect(router.replace).not.toHaveBeenCalled()
  })
})
