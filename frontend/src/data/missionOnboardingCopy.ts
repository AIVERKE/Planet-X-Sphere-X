/** Textos de la Guía / tour. Independientes del store i18n para no tumbar el atlas. */
export const MISSION_ONBOARDING_ES = {
  openGuide: 'Guía',
  skip: 'Omitir',
  next: 'Siguiente',
  back: 'Atrás',
  done: 'Listo',
  progress: 'Paso {current} de {total}',
  guideTitle: 'Cómo usar el atlas',
  guideLead:
    'Sigue este flujo: elige un lugar, mira sus capturas, abre el blink y busca cambios entre fechas.',
  guideClose: 'Cerrar',
  guideRestart: 'Ver tour',
  glossaryTitle: 'Palabras útiles',
  steps: {
    atlas: {
      title: 'El mapa del cielo',
      body: 'Esto es el atlas: arrastra para moverte y usa la rueda para acercar (zoom = campo de visión).',
    },
    targets: {
      title: 'Elige un objetivo',
      body: 'Los Objetivos son destinos listos (presets). Toca uno para ir a esa zona del cielo.',
    },
    data: {
      title: 'Mira las capturas',
      body: 'En Datos ves las observaciones (fotos) de esa región y puedes abrir el detalle de cada una.',
    },
    motion: {
      title: 'Abre el movimiento',
      body: 'En Movimiento reproduce las épocas como un video corto (timelapse / blink) para ver cambios.',
    },
    interpret: {
      title: 'Busca lo que “salta”',
      body: 'Si algo se mueve o cambia de brillo entre fotogramas, es lo que buscamos. Abre Guía cuando quieras repasar.',
    },
  },
  guideSections: [
    {
      id: 'find',
      title: '1. Encuentra un lugar',
      body: 'Usa Objetivos o Buscar (coordenadas) para centrar el atlas en una región.',
    },
    {
      id: 'data',
      title: '2. Revisa Datos',
      body: 'Ahí están las capturas SPHEREx de la zona. Detalle muestra metadatos e imagen.',
    },
    {
      id: 'motion',
      title: '3. Abre Movimiento',
      body: 'El blink compara varias épocas (fotos en distintas fechas) una tras otra.',
    },
    {
      id: 'read',
      title: '4. Interpreta el cambio',
      body: 'Movimiento propio, variación de brillo o un objeto que “aparece” entre cuadros.',
    },
  ],
  terms: [
    {
      term: 'Época',
      meaning: 'Una foto de la misma zona tomada en otra fecha.',
    },
    {
      term: 'Blink / timelapse',
      meaning: 'Reproducir esas épocas rápido, como un video corto.',
    },
    {
      term: 'SPHEREx',
      meaning: 'Satélite NASA de mapa infrarrojo cercano (~102 bandas). Fuente principal del blink.',
    },
  ],
} as const

export type MissionOnboardingCopy = {
  openGuide: string
  skip: string
  next: string
  back: string
  done: string
  progress: string
  guideTitle: string
  guideLead: string
  guideClose: string
  guideRestart: string
  glossaryTitle: string
  steps: Record<string, { title: string; body: string }>
  guideSections: Array<{ id: string; title: string; body: string }>
  terms: Array<{ term: string; meaning: string }>
}

export function resolveMissionOnboarding(
  candidate: MissionOnboardingCopy | null | undefined,
): MissionOnboardingCopy {
  if (candidate && typeof candidate.openGuide === 'string' && candidate.steps) {
    return candidate
  }
  // `as const` del objeto ES → mutable para el tipo de la UI.
  return MISSION_ONBOARDING_ES as unknown as MissionOnboardingCopy
}
