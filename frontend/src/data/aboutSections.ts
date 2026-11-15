export interface AboutSectionMeta {
  id: string
  index: string
  /** Ventana de visibilidad del copy en [0,1] del scroll. */
  copyStart: number
  copyEnd: number
  /** Progreso de cámara asociado. */
  cameraAt: number
}

/** Capítulos del recorrido “Qué somos” (scroll + flechas). */
export const aboutSections: AboutSectionMeta[] = [
  {
    id: 'hook',
    index: '01',
    copyStart: 0.0,
    copyEnd: 0.12,
    cameraAt: 0.04,
  },
  {
    id: 'background',
    index: '02',
    copyStart: 0.1,
    copyEnd: 0.23,
    cameraAt: 0.15,
  },
  {
    id: 'problema',
    index: '03',
    copyStart: 0.21,
    copyEnd: 0.34,
    cameraAt: 0.26,
  },
  {
    id: 'historia',
    index: '04',
    copyStart: 0.32,
    copyEnd: 0.45,
    cameraAt: 0.37,
  },
  {
    id: 'solucion',
    index: '05',
    copyStart: 0.43,
    copyEnd: 0.56,
    cameraAt: 0.48,
  },
  {
    id: 'demo',
    index: '06',
    copyStart: 0.54,
    copyEnd: 0.67,
    cameraAt: 0.59,
  },
  {
    id: 'futuro',
    index: '07',
    copyStart: 0.65,
    copyEnd: 0.78,
    cameraAt: 0.7,
  },
  {
    id: 'alianzas',
    index: '08',
    copyStart: 0.76,
    copyEnd: 0.89,
    cameraAt: 0.81,
  },
  {
    id: 'cierre',
    index: '09',
    copyStart: 0.87,
    copyEnd: 1.01,
    cameraAt: 0.94,
  },
]
