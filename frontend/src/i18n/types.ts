export type Locale = 'es' | 'en'

export interface ChapterCopy {
  name: string
  title: string
  body: string
}

export interface PlanetCopy {
  name: string
  type: string
  hotspots: Record<string, string>
}

export interface Messages {
  lang: {
    switchTo: string
    switchToShort: string
    current: string
    aria: string
  }
  brand: string
  nav: {
    landscape: string
    world: string
    space: string
    explore: string
    spherex: string
    catalog: string
    about: string
    menu: string
    close: string
  }
  look: {
    loading: string
    lookingSky: string
    dragHint: string
    ascend: string
    landscapeCredit: string
  }
  scroll: {
    continue: string
  }
  chapters: Record<string, ChapterCopy>
  markers: Record<string, string>
  search: {
    label: string
    placeholder: string
    empty: string
  }
  filters: {
    aria: string
    todos: string
    estrella: string
    rocosos: string
    gaseosos: string
    satelite: string
    habitables: string
  }
  telemetry: {
    mission: string
    distance: string
    gravity: string
    temperature: string
    habitability: string
    atmosphere: string
    travelOrbit: string
    travelSurface: string
    backOrbit: string
    backJourney: string
    au: string
  }
  planets: Record<string, PlanetCopy>
  gases: Record<string, string>
  spherex: {
    titleLine1: string
    titleLine2: string
    openLine1: string
    openLine2: string
    openTitle: string
    probeAlt: string
  }
  mission: {
    eyebrow: string
    title: string
    back: string
    loading: string
    errorTitle: string
    errorFallback: string
    retry: string
    hint: string
    aladinAria: string
    onboarding: {
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
      steps: Record<
        'atlas' | 'targets' | 'data' | 'motion' | 'interpret',
        { title: string; body: string }
      >
      guideSections: Array<{ id: string; title: string; body: string }>
      terms: Array<{ term: string; meaning: string }>
    }
  }
  panel: {
    homeTitle: string
    homeBody: string
    navHome: string
    openMenu: string
  }
  about: {
    brand: string
    back: string
    scrollHint: string
    loading: string
    error: string
    catalogCta: string
    sections: Record<
      string,
      {
        name: string
        title: string
        body: string
        points?: string[]
      }
    >
  }
  catalog: {
    kicker: string
    title: string
    lead: string
    back: string
    close: string
    onboarding: string
    onboardingDismiss: string
    far: string
    identify: string
    identifyHint: string
    /** `{n}` marcadas de `{total}`. */
    identifyProgress: string
    traps: string
    compare: string
    compareGroup: string
    compareModel: string
    comparePhoto: string
    credit: string
    license: string
    imageAdapted: string
    imageSource: string
    search: string
    example: string
    /** `{name}`: nombre del ejemplo. */
    ctaFixed: string
    /** `{name}`: cuerpo; `{date}`: fecha del cálculo. */
    ctaEphemeris: string
    ephemerisNote: string
    rows: Record<'sky', string>
    /** aria-label del canvas 3D de cada forma. */
    orb: Record<'nebula' | 'ring' | 'galaxy' | 'jupiter', string>
  }
  routes: {
    explorer: string
    mission: string
    home: string
    about: string
    catalog: string
  }
}
