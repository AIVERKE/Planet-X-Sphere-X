import { afterEach, describe, expect, it, vi } from 'vitest'
import { patchAladinNetwork, presetSurvey } from './loadAladinLite'

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
