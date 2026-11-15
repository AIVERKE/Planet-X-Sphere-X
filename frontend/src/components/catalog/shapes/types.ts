import type { Color, Object3D, Texture } from 'three'

export interface Disposable {
  dispose: () => void
}

/** Registra un recurso GPU para liberarlo en el teardown de la orb. */
export type Keep = <T extends Disposable>(item: T) => T

export interface ShapeContext {
  keep: Keep
  /** entry.colors ya convertidos a Color (espacio de trabajo lineal). */
  colors: [Color, Color, Color]
  /** Uniform compartido: segundos de animación acumulados (solo avanza mientras corre). */
  time: { value: number }
  /** Uniform compartido: px por unidad de mundo a distancia 1 (se actualiza en resize). */
  pointScale: { value: number }
  /** Carga una textura; inyectable para tests. */
  loadTexture: (url: string, onLoad: () => void) => Texture
  /** Pide un cuadro cuando el bucle está parado (p. ej. al terminar de cargar una textura). */
  invalidate: () => void
}

export interface ShapeBuild {
  object: Object3D
  /** Distancia de la cámara al origen para encuadrar la forma. */
  cameraZ: number
  /** Tope de DPR propio de la forma (por debajo del global de 1.5) para formas difusas y caras. */
  pixelRatio?: number
  /** Instante representativo para el cuadro estático (prefers-reduced-motion). */
  stillTime: number
  /** Pose ABSOLUTA en función de t (segundos). No crea objetos. */
  update: (t: number) => void
}

export type ShapeBuilder = (ctx: ShapeContext) => ShapeBuild
