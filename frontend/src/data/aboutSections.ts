export interface AboutSectionMeta {
  id: string
  index: string
  /** Ventana de visibilidad del copy en [0,1] del scroll. */
  copyStart: number
  copyEnd: number
  /** Progreso de cámara asociado. */
  cameraAt: number
}

/** Capítulos del recorrido “Qué somos” (solo scroll). */
export const aboutSections: AboutSectionMeta[] = [
  {
    id: 'vision',
    index: '01',
    copyStart: 0.02,
    copyEnd: 0.16,
    cameraAt: 0.08,
  },
  {
    id: 'proposito',
    index: '02',
    copyStart: 0.18,
    copyEnd: 0.32,
    cameraAt: 0.25,
  },
  {
    id: 'problema',
    index: '03',
    copyStart: 0.34,
    copyEnd: 0.48,
    cameraAt: 0.42,
  },
  {
    id: 'solucion',
    index: '04',
    copyStart: 0.5,
    copyEnd: 0.64,
    cameraAt: 0.58,
  },
  {
    id: 'impacto',
    index: '05',
    copyStart: 0.66,
    copyEnd: 0.8,
    cameraAt: 0.74,
  },
  {
    id: 'futuro',
    index: '06',
    copyStart: 0.82,
    copyEnd: 0.96,
    cameraAt: 0.9,
  },
]
