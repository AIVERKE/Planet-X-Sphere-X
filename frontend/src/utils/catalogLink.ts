/**
 * Del catálogo al explorador: coordenadas de cada entrada y query de `/mision`.
 */

import { Body, Equator, Observer } from 'astronomy-engine'
import type { LocationQueryRaw } from 'vue-router'
import { buildQuery, clampFov } from '@/composables/useSkyUrlState'
import type { CatalogEntry, EphemerisBody, MissionLink } from '@/data/skyCatalog'
import { isValidDec, isValidRa } from '@/utils/skyFormat'

export type SkyPoint = { ra: number; dec: number; fov: number }

/** Ruta hacia el explorador; asignable a `RouteLocationRaw`. */
export type MissionRoute = { name: 'mission'; query: LocationQueryRaw }

const BODIES: Record<EphemerisBody, Body> = {
  Jupiter: Body.Jupiter,
}

/**
 * Observador en lat 0°, lon 0°, nivel del mar: no hace falta pedir la ubicación.
 * Para Júpiter el paralaje frente al geocentro es ≤ 2″, muy por debajo de lo que se ve en el atlas.
 */
const GEOCENTRIC = new Observer(0, 0, 0)

/**
 * RA/Dec J2000 (grados) y FOV del ejemplo de una entrada.
 * `ephemeris` calcula la posición en `date` (light-time + aberración, J2000).
 */
export function resolveCoords(link: MissionLink, date: Date = new Date()): SkyPoint {
  if (link.kind === 'fixed') {
    return { ra: link.ra, dec: link.dec, fov: link.fov }
  }
  const eq = Equator(BODIES[link.body], date, GEOCENTRIC, false, true)
  return { ra: eq.ra * 15, dec: eq.dec, fov: link.fov }
}

/**
 * Ruta `/mision?ra=&dec=&fov=` (sin `target`: los ejemplos no son presets del backend).
 * Devuelve `null` si las coordenadas no son válidas; entonces no se muestra el botón.
 */
export function missionQuery(entry: CatalogEntry, date?: Date): MissionRoute | null {
  const { ra, dec, fov } = resolveCoords(entry.missionLink, date)
  if (!isValidRa(ra) || !isValidDec(dec) || !Number.isFinite(fov) || fov <= 0) return null
  return {
    name: 'mission',
    query: buildQuery({ ra, dec, fov: clampFov(fov), target: null }),
  }
}
