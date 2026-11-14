export type PlanetCategory = 'rocosos' | 'gaseosos' | 'habitables' | 'estrella' | 'satelite'

export type PlanetFilter = 'todos' | PlanetCategory

export type CameraMode = 'look' | 'scroll' | 'travel' | 'orbit'

export type Phase = 1 | 2 | 3 | 4 | 5

export type Approach = 'orbit' | 'surface'

export interface AtmosphereGas {
  gas: string
  ratio: number
}

export interface Hotspot {
  id: string
  label: string
  position: [number, number, number]
}

export type PlanetMapId =
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'mercury'
  | 'venus'
  | 'uranus'
  | 'neptune'
  | 'sun'
  | 'moon'

export interface Planet {
  id: string
  name: string
  type: string
  category: PlanetCategory
  radius: number
  distanceAu: number
  gravity: number
  temperatureC: number
  habitability: number
  atmosphere: AtmosphereGas[]
  colors: {
    a: string
    b: string
    c: string
    atmosphere: string
  }
  orbitPosition: [number, number, number]
  hotspots: [Hotspot, Hotspot]
  seed: number
  bands: boolean
  rings: boolean
  /** Textura 2K en assets/images (2k_<id>...). */
  mapId?: PlanetMapId
}

export interface WorldMarkerData {
  id: string
  index: string
  name: string
  lat: number
  lon: number
}

export interface Chapter {
  id: string
  index: string
  name: string
  phase: Phase
  copyStart: number
  copyEnd: number
  title: string
  body: string
}
