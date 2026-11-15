import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HIPS_DOWN_TTL_MS,
  HIPS_FALLBACK_TIMEOUT_MS,
  HIPS_PREFER_TIMEOUT_MS,
  LOCAL_HIPS,
  forgetHipsHealth,
  patchAladinNetwork,
  pickStartHips,
  presetSurvey,
  type HipsProbe,
} from './loadAladinLite'

const ESA = LOCAL_HIPS['esa-dss'].url
const IRSA = LOCAL_HIPS['dss2-color'].url

/** Sonda falsa: `up` dice qué URLs responden. */
function fakeProbe(up: Record<string, boolean>) {
  return vi.fn<HipsProbe>(async (url) => up[url] ?? false)
}

describe('pickStartHips', () => {
  beforeEach(() => forgetHipsHealth())

  it('prefiere ESA cuando responde', async () => {
    const probe = fakeProbe({ [ESA]: true, [IRSA]: true })
    expect(await pickStartHips(probe)).toBe('esa-dss')
  })

  it('prueba ESA e IRSA a la vez, con más margen para IRSA', async () => {
    const probe = fakeProbe({ [ESA]: false, [IRSA]: true })
    expect(await pickStartHips(probe)).toBe('dss2-color')
    expect(probe).toHaveBeenCalledWith(IRSA, HIPS_FALLBACK_TIMEOUT_MS)
    expect(probe).toHaveBeenCalledWith(ESA, HIPS_PREFER_TIMEOUT_MS)
    expect(HIPS_FALLBACK_TIMEOUT_MS).toBeGreaterThan(HIPS_PREFER_TIMEOUT_MS)
    // IRSA arranca antes de esperar a ESA: no se suman los dos timeouts.
    expect(probe.mock.calls[0]?.[0]).toBe(IRSA)
  })

  it('recuerda que ESA está caído y la siguiente visita no lo espera', async () => {
    let clock = 1_000
    const now = () => clock
    const probe = fakeProbe({ [ESA]: false, [IRSA]: true })
    expect(await pickStartHips(probe, now)).toBe('dss2-color')

    probe.mockClear()
    clock += 60_000
    expect(await pickStartHips(probe, now)).toBe('dss2-color')
    expect(probe).not.toHaveBeenCalledWith(ESA, expect.anything())

    probe.mockClear()
    clock += HIPS_DOWN_TTL_MS
    await pickStartHips(probe, now)
    expect(probe).toHaveBeenCalledWith(ESA, HIPS_PREFER_TIMEOUT_MS)
  })

  it('devuelve null si ninguno responde', async () => {
    expect(await pickStartHips(fakeProbe({}))).toBeNull()
  })
})

describe('presetSurvey', () => {
  it('con ESA disponible: objetos puntuales por ESA y campos amplios por IRSA', () => {
    expect(presetSurvey('official_test', true)).toBe('esa-dss')
    expect(presetSurvey('survey_field', true)).toBe('dss2-color')
  })

  it('si ESA no respondió al arrancar, todo va por IRSA', () => {
    expect(presetSurvey('official_test', false)).toBe('dss2-color')
    expect(presetSurvey('survey_field', false)).toBe('dss2-color')
  })
})

describe('patchAladinNetwork', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('responde 204 sin cuerpo a la telemetría de CDS y deja pasar el resto', async () => {
    const realFetch = vi.fn(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('window', { fetch: realFetch })
    patchAladinNetwork()

    const blocked = await window.fetch('https://alasky.unistra.fr/cgi/AladinLiteLogger?action=start')
    expect(blocked.status).toBe(204)
    expect(blocked.body).toBeNull()
    expect(realFetch).not.toHaveBeenCalled()

    const passed = await window.fetch('/hips/irsa-dss/properties')
    expect(passed.status).toBe(200)
    expect(realFetch).toHaveBeenCalledTimes(1)
  })
})
