import type { Messages } from '@/i18n/types'

export const en: Messages = {
  lang: {
    switchTo: 'Español',
    switchToShort: 'ES',
    current: 'EN',
    aria: 'Translate to Spanish',
  },
  brand: 'Planet X and SPHEREx',
  nav: {
    landscape: 'Landscape',
    world: 'World',
    space: 'Space',
    explore: 'Explore',
    spherex: 'SPHEREx',
    catalog: 'Catalog',
    about: 'About us',
    menu: 'Menu',
    close: 'Close',
  },
  look: {
    loading: 'Loading landscape…',
    lookingSky: 'Keep looking at the sky for 2 seconds…',
    dragHint: 'Drag to look around · look up at the sky to ascend',
    ascend: 'Ascend to space',
  },
  scroll: {
    continue: 'Scroll to continue',
  },
  chapters: {
    paisaje: {
      name: 'Landscape',
      title: 'A valley under the sky',
      body: 'You are inside the landscape. Drag to look around. When you lift your gaze to the sky, the journey continues into space.',
    },
    mundo: {
      name: 'World',
      title: 'The world beneath the clouds',
      body: 'Earth turns beneath the clouds. From here the planet stops being a landscape and becomes a whole body in the void.',
    },
    ascenso: {
      name: 'Ascent',
      title: 'The limbo turns black',
      body: 'Earth shrinks into a blue halo. The ground stops being a landscape and becomes one body among others.',
    },
    explorador: {
      name: 'Explorer',
      title: 'Choose a body and approach',
      body: 'From here the camera leaves the scroll. Search, filter, and travel. In orbit you can spin the planet with the cursor.',
    },
    spherex: {
      name: 'SPHEREx',
      title: 'Probe in the void',
      body: 'Beyond the solar system, the SPHEREx probe orbits against the star field. From here you can open Aladin Lite.',
    },
  },
  markers: {
    'marker-amazonas': 'Amazon',
    'marker-himalaya': 'Himalayas',
    'marker-pacifico': 'Pacific',
    'marker-andes': 'Andes',
  },
  search: {
    label: 'Search',
    placeholder: 'Name, type, or atmosphere',
    empty: 'No bodies match your search.',
  },
  filters: {
    aria: 'Filter planets',
    todos: 'All',
    estrella: 'Star',
    rocosos: 'Rocky',
    gaseosos: 'Gas giants',
    satelite: 'Satellite',
    habitables: 'Habitable exoplanets',
  },
  telemetry: {
    mission: 'Planet X and SPHEREx',
    distance: 'Orbital distance',
    gravity: 'Gravity',
    temperature: 'Temperature',
    habitability: 'Habitability',
    atmosphere: 'Atmosphere',
    travelOrbit: 'Travel to orbit',
    travelSurface: 'Travel to surface',
    backOrbit: 'Return to orbit',
    backJourney: 'Back to the journey',
    au: 'AU',
  },
  planets: {
    sun: {
      name: 'Sun',
      type: 'Star',
      hotspots: {
        'sun-mancha': 'Sunspot',
        'sun-corona': 'Coronal region',
      },
    },
    mercury: {
      name: 'Mercury',
      type: 'Rocky',
      hotspots: {
        'mercury-caloris': 'Caloris Basin',
        'mercury-polo': 'North pole',
      },
    },
    venus: {
      name: 'Venus',
      type: 'Rocky',
      hotspots: {
        'venus-maxwell': 'Maxwell Montes',
        'venus-aphrodite': 'Aphrodite Terra',
      },
    },
    earth: {
      name: 'Earth',
      type: 'Rocky',
      hotspots: {
        'earth-amazonas': 'Amazon Basin',
        'earth-himalaya': 'Himalayas',
      },
    },
    moon: {
      name: 'Moon',
      type: 'Satellite',
      hotspots: {
        'moon-tranquillitatis': 'Sea of Tranquility',
        'moon-tycho': 'Tycho Crater',
      },
    },
    mars: {
      name: 'Mars',
      type: 'Rocky',
      hotspots: {
        'mars-olimpo': 'Olympus Mons',
        'mars-valles': 'Valles Marineris',
      },
    },
    jupiter: {
      name: 'Jupiter',
      type: 'Gas giant',
      hotspots: {
        'jupiter-mancha': 'Great Red Spot',
        'jupiter-polo': 'North pole',
      },
    },
    saturn: {
      name: 'Saturn',
      type: 'Gas giant',
      hotspots: {
        'saturn-hexagono': 'Polar hexagon',
        'saturn-cassini': 'Cassini Division',
      },
    },
    uranus: {
      name: 'Uranus',
      type: 'Gas giant',
      hotspots: {
        'uranus-polo': 'Tilted pole',
        'uranus-anillo': 'Ring system',
      },
    },
    neptune: {
      name: 'Neptune',
      type: 'Gas giant',
      hotspots: {
        'neptune-mancha': 'Great Dark Spot',
        'neptune-vientos': 'Supersonic winds',
      },
    },
    'kepler-186f': {
      name: 'Kepler-186f',
      type: 'Rocky exoplanet',
      hotspots: {
        'kepler-bruma': 'Mist coast',
        'kepler-casquete': 'Bright cap',
      },
    },
    'trappist-1e': {
      name: 'Trappist-1e',
      type: 'Rocky exoplanet',
      hotspots: {
        'trappist-terminador': 'Terminator',
        'trappist-cuenca': 'Dark basin',
      },
    },
  },
  gases: {
    Hidrógeno: 'Hydrogen',
    Helio: 'Helium',
    Otros: 'Other',
    Exosfera: 'Exosphere',
    'Dióxido de carbono': 'Carbon dioxide',
    Nitrógeno: 'Nitrogen',
    Oxígeno: 'Oxygen',
    Argón: 'Argon',
    Metano: 'Methane',
    'Vapor de agua': 'Water vapor',
  },
  spherex: {
    titleLine1: 'SphereX,',
    titleLine2: "NASA's space observatory",
    openLine1: 'Open the mission',
    openLine2: 'Planet X and SPHEREx',
    openTitle: 'Open Aladin Lite explorer (lazy load)',
    probeAlt: 'SPHEREx space probe with metallic reflector',
  },
  mission: {
    eyebrow: 'Mission · Planet X and SPHEREx',
    title: 'Outer space',
    back: 'Back to the journey',
    loading: 'Loading Aladin Lite…',
    errorTitle: 'Could not start the explorer',
    errorFallback: 'Could not load Aladin Lite',
    retry: 'Retry',
    hint: 'Drag to explore · scroll to zoom (infinite HiPS tiles)',
    aladinAria: 'Aladin Lite explorer',
    onboarding: {
      openGuide: 'Guide',
      skip: 'Skip',
      next: 'Next',
      back: 'Back',
      done: 'Done',
      progress: 'Step {current} of {total}',
      guideTitle: 'How to use the atlas',
      guideLead:
        'Follow this flow: pick a place, review its captures, open the blink, and look for changes across dates.',
      guideClose: 'Close',
      guideRestart: 'Replay tour',
      glossaryTitle: 'Useful words',
      steps: {
        atlas: {
          title: 'The sky map',
          body: 'This is the atlas: drag to pan and use the wheel to zoom (zoom = field of view).',
        },
        targets: {
          title: 'Pick a target',
          body: 'Targets are ready-made destinations (presets). Tap one to jump to that sky region.',
        },
        data: {
          title: 'Review the captures',
          body: 'Under Data you see observations (images) for that region and can open each one’s detail.',
        },
        motion: {
          title: 'Open motion',
          body: 'Under Motion, play epochs as a short movie (timelapse / blink) to spot changes.',
        },
        interpret: {
          title: 'Watch what “jumps”',
          body: 'If something moves or changes brightness between frames, that’s the signal. Open Guide anytime to review.',
        },
      },
      guideSections: [
        {
          id: 'find',
          title: '1. Find a place',
          body: 'Use Targets or Search (coordinates) to center the atlas on a region.',
        },
        {
          id: 'data',
          title: '2. Check Data',
          body: 'There you’ll find SPHEREx captures for the area. Detail shows metadata and the image.',
        },
        {
          id: 'motion',
          title: '3. Open Motion',
          body: 'The blink compares several epochs (photos from different dates) one after another.',
        },
        {
          id: 'read',
          title: '4. Read the change',
          body: 'Proper motion, brightness variation, or an object that “appears” between frames.',
        },
      ],
      terms: [
        {
          term: 'Epoch',
          meaning: 'A photo of the same region taken on another date.',
        },
        {
          term: 'Blink / timelapse',
          meaning: 'Playing those epochs quickly, like a short video.',
        },
        {
          term: 'FOV',
          meaning: 'Field of view: how much sky fits on screen (more zoom = smaller FOV).',
        },
        {
          term: 'Bands D1–D6',
          meaning: 'SPHEREx detectors / near-infrared light ranges.',
        },
        {
          term: 'RAW and HD',
          meaning: 'Satellite raw view vs. a stretched version that’s easier to read in infrared.',
        },
      ],
    },
  },
  panel: {
    homeTitle: 'Home',
    homeBody: 'Vue 3 frontend structure ready to build on the MOF design system.',
    navHome: 'Home',
    openMenu: 'Open or close menu',
  },
  about: {
    brand: 'About us',
    back: 'Back to the journey',
    scrollHint: 'Scroll to continue',
    loading: 'Loading space…',
    error: 'Could not start the 3D scene',
    sections: {
      vision: {
        name: 'Vision',
        title: 'A public viewer for the SPHEREx sky',
        body: 'We turn NASA’s infrared all-sky map into something anyone can explore—no astronomy background or coding required.',
        points: [
          '102 near-infrared bands (0.75–5.0 µm)',
          'The whole sky every six months',
          'More than a billion objects',
        ],
      },
      proposito: {
        name: 'Purpose',
        title: 'Pick a region. Watch it change.',
        body: 'Enter coordinates or an object name, choose the field of view, and play epochs as a short blink movie. Moving or brightening sources jump out.',
        points: [
          'Shareable URL queries',
          'Inspired by WiseView and citizen science',
          'Validated on the 5 NASA challenge targets',
        ],
      },
      problema: {
        name: 'Problem',
        title: 'Too much sky to check by hand',
        body: 'SPHEREx produces more data than anyone can scan alone. Specialized tools shut out the public—the very people who could help find more.',
        points: [
          'Heavy FITS and high latency',
          'Few lightweight time-aware viewers',
          '102 bands hard to read raw',
        ],
      },
      solucion: {
        name: 'Solution',
        title: 'Open API + on-demand cutouts',
        body: 'FastAPI + Astropy + Astroquery query IRSA, filter epochs, and fetch only the sky patch you need. Cache, false color, blinking, and Aladin Lite to confirm.',
        points: [
          'Metadata and links, not full FITS',
          'Sum, difference, and live spectra',
          'Gaia and WISE over SPHEREx',
        ],
      },
      impacto: {
        name: 'Impact',
        title: 'Citizen science from Bolivia',
        body: 'Free software and public data in the browser, at minimal cost. Built for schools, universities, and astronomy clubs across the region.',
        points: [
          'Spanish and English',
          'Guided detective mode',
          'Replicable without expensive infrastructure',
        ],
      },
      futuro: {
        name: 'Future',
        title: 'A demo in under a minute',
        body: 'FastAPI backend is ready. The roadmap finishes the frontend, cutout cache, differences, spectra, and catalogs. Success: see motion and variability without being an astronomer.',
        points: [
          'Player + FOV + URL',
          'Difference images',
          'Visible quality flags',
        ],
      },
    },
  },
  catalog: {
    kicker: 'Field guide',
    title: 'A catalog for reading the sky',
    lead: 'Each body turns the way it looks from a distance. Open one to see the signs that give it away, compare it with a real photo, and find it in SPHEREx.',
    back: 'Back',
    close: 'Close',
    onboarding: 'Pick a body, compare it with the real photo, and jump to the explorer.',
    onboardingDismiss: 'Got it',
    far: 'From afar',
    identify: 'How to identify it',
    identifyHint: 'Tick each sign you can see.',
    identifyProgress: '{n} of {total}',
    traps: 'Common mix-ups',
    compare: 'Compare',
    compareGroup: 'What to show',
    compareModel: '3D animation',
    comparePhoto: 'Real photo',
    credit: 'Credit',
    license: 'License',
    imageAdapted: 'adapted (crop and size)',
    imageSource: 'See the original image',
    search: 'Find it in SPHEREx',
    example: 'Example',
    ctaFixed: 'See {name} in the explorer',
    ctaEphemeris: 'See {name} on {date} in the explorer',
    ephemerisNote: 'The position is computed when you click. SPHEREx images of that area were taken on other dates, so Jupiter need not appear in them: it has already moved. That shift is exactly what gives it away as a planet.',
    rows: {
      sky: 'In the sky',
    },
    orb: {
      nebula: 'Animation of an emission nebula: a gas cloud with filaments, dark gaps and stars inside',
      ring: 'Animation of a planetary nebula: a ring-shaped shell of gas with a star at its center',
      galaxy: 'Animation of a tilted spiral galaxy: an elongated disk with bluish arms, a yellowish core and dust lanes',
      jupiter: 'Animation of Jupiter: a banded planet with the Great Red Spot',
    },
  },
  routes: {
    explorer: 'Explore',
    mission: 'SPHEREx Mission',
    home: 'Panel',
    about: 'About us',
    catalog: 'Catalog',
  },
}
