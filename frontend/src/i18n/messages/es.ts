import type { Messages } from '@/i18n/types'

export const es: Messages = {
  lang: {
    switchTo: 'English',
    switchToShort: 'EN',
    current: 'ES',
    aria: 'Traducir a inglés',
  },
  brand: 'SCOUT · SPHEREx',
  nav: {
    landscape: 'Paisaje',
    world: 'Mundo',
    space: 'Espacio',
    explore: 'Explorar',
    spherex: 'SPHEREx',
    catalog: 'Catálogo',
    about: 'Qué somos',
    menu: 'Menú',
    close: 'Cerrar',
  },
  look: {
    loading: 'Cargando paisaje…',
    lookingSky: 'Mantén la vista al cielo 2 segundos…',
    dragHint: 'Arrastra para mirar · mira arriba al cielo para ascender',
    ascend: 'Ascender al espacio',
    landscapeCredit: 'Paisaje · Greg Zaal',
  },
  scroll: {
    continue: 'Desliza para continuar',
  },
  chapters: {
    paisaje: {
      name: 'Paisaje',
      title: 'Un valle bajo el cielo',
      body: 'Estás dentro del paisaje. Arrastra para mirar a todos lados. Cuando eleves la vista al cielo, el viaje continúa hacia el espacio.',
    },
    mundo: {
      name: 'Mundo',
      title: 'El mundo bajo las nubes',
      body: 'La Tierra gira bajo las nubes. Desde aquí el planeta deja de ser paisaje y se vuelve un cuerpo completo en el vacío.',
    },
    ascenso: {
      name: 'Ascenso',
      title: 'El limbo se vuelve negro',
      body: 'La Tierra se reduce a un halo azul. El suelo deja de ser paisaje y pasa a ser un cuerpo entre otros.',
    },
    explorador: {
      name: 'Explorador',
      title: 'Elige un cuerpo y acércate',
      body: 'A partir de aquí la cámara se suelta del scroll. Busca, filtra y viaja. En órbita puedes girar el planeta con el cursor.',
    },
    spherex: {
      name: 'SPHEREx',
      title: 'Sonda en el vacío',
      body: 'Más allá del sistema solar, la sonda SPHEREx orbita sobre el fondo estelar. Desde aquí podrás abrir Aladin Lite.',
    },
  },
  markers: {
    'marker-amazonas': 'Amazonas',
    'marker-himalaya': 'Himalaya',
    'marker-pacifico': 'Pacífico',
    'marker-andes': 'Andes',
  },
  search: {
    label: 'Buscador',
    placeholder: 'Nombre, tipo o atmósfera',
    empty: 'Ningún cuerpo coincide con la búsqueda.',
  },
  filters: {
    aria: 'Filtrar planetas',
    todos: 'Todos',
    estrella: 'Estrella',
    rocosos: 'Rocosos',
    gaseosos: 'Gigantes gaseosos',
    satelite: 'Satélite',
    habitables: 'Exoplanetas habitables',
  },
  telemetry: {
    mission: 'SCOUT · SPHEREx',
    distance: 'Distancia orbital',
    gravity: 'Gravedad',
    temperature: 'Temperatura',
    habitability: 'Habitabilidad',
    atmosphere: 'Atmósfera',
    travelOrbit: 'Viajar a órbita',
    travelSurface: 'Viajar a superficie',
    backOrbit: 'Volver a órbita',
    backJourney: 'Volver al viaje',
    au: 'UA',
  },
  planets: {
    sun: {
      name: 'Sol',
      type: 'Estrella',
      hotspots: {
        'sun-mancha': 'Mancha solar',
        'sun-corona': 'Región coronal',
      },
    },
    mercury: {
      name: 'Mercurio',
      type: 'Rocoso',
      hotspots: {
        'mercury-caloris': 'Cuenca Caloris',
        'mercury-polo': 'Polo norte',
      },
    },
    venus: {
      name: 'Venus',
      type: 'Rocoso',
      hotspots: {
        'venus-maxwell': 'Maxwell Montes',
        'venus-aphrodite': 'Terra Aphrodite',
      },
    },
    earth: {
      name: 'Tierra',
      type: 'Rocoso',
      hotspots: {
        'earth-amazonas': 'Cuenca del Amazonas',
        'earth-himalaya': 'Himalaya',
      },
    },
    moon: {
      name: 'Luna',
      type: 'Satélite',
      hotspots: {
        'moon-tranquillitatis': 'Mar de la Tranquilidad',
        'moon-tycho': 'Cráter Tycho',
      },
    },
    mars: {
      name: 'Marte',
      type: 'Rocoso',
      hotspots: {
        'mars-olimpo': 'Olympus Mons',
        'mars-valles': 'Valles Marineris',
      },
    },
    jupiter: {
      name: 'Júpiter',
      type: 'Gigante gaseoso',
      hotspots: {
        'jupiter-mancha': 'Gran Mancha Roja',
        'jupiter-polo': 'Polo norte',
      },
    },
    saturn: {
      name: 'Saturno',
      type: 'Gigante gaseoso',
      hotspots: {
        'saturn-hexagono': 'Hexágono polar',
        'saturn-cassini': 'División de Cassini',
      },
    },
    uranus: {
      name: 'Urano',
      type: 'Gigante gaseoso',
      hotspots: {
        'uranus-polo': 'Polo inclinado',
        'uranus-anillo': 'Sistema de anillos',
      },
    },
    neptune: {
      name: 'Neptuno',
      type: 'Gigante gaseoso',
      hotspots: {
        'neptune-mancha': 'Gran Mancha Oscura',
        'neptune-vientos': 'Vientos supersónicos',
      },
    },
    'kepler-186f': {
      name: 'Kepler-186f',
      type: 'Exoplaneta rocoso',
      hotspots: {
        'kepler-bruma': 'Costa de bruma',
        'kepler-casquete': 'Casquete claro',
      },
    },
    'trappist-1e': {
      name: 'Trappist-1e',
      type: 'Exoplaneta rocoso',
      hotspots: {
        'trappist-terminador': 'Terminador',
        'trappist-cuenca': 'Cuenca oscura',
      },
    },
  },
  gases: {
    Hidrógeno: 'Hidrógeno',
    Helio: 'Helio',
    Otros: 'Otros',
    Exosfera: 'Exosfera',
    'Dióxido de carbono': 'Dióxido de carbono',
    Nitrógeno: 'Nitrógeno',
    Oxígeno: 'Oxígeno',
    Argón: 'Argón',
    Metano: 'Metano',
    'Vapor de agua': 'Vapor de agua',
  },
  spherex: {
    titleLine1: 'SphereX,',
    titleLine2: 'el observatorio espacial de la NASA',
    openLine1: 'Abrir la misión',
    openLine2: 'SCOUT · SPHEREx',
    openTitle: 'Abrir explorador Aladin Lite (carga diferida)',
    probeAlt: 'Sonda espacial SPHEREx de reflector metálico',
  },
  mission: {
    eyebrow: 'Misión · SCOUT · SPHEREx',
    title: 'Espacio exterior',
    back: 'Volver al recorrido',
    loading: 'Cargando Aladin Lite…',
    errorTitle: 'No se pudo iniciar el explorador',
    errorFallback: 'No se pudo cargar Aladin Lite',
    retry: 'Reintentar',
    hint: 'Arrastra para explorar · rueda para acercar (tiles HiPS infinitos)',
    aladinAria: 'Explorador Aladin Lite',
    onboarding: {
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
          term: 'FOV',
          meaning: 'Campo de visión: cuánto cielo caben en pantalla (más zoom = FOV más chico).',
        },
        {
          term: 'Bandas D1–D6',
          meaning: 'Detectores / rangos de luz infrarroja de SPHEREx.',
        },
        {
          term: 'RAW y HD',
          meaning: 'Vista cruda del satélite vs. versión estirada para leer mejor el infrarrojo.',
        },
      ],
    },
  },
  panel: {
    homeTitle: 'Inicio',
    homeBody: 'Estructura frontend Vue 3 lista para desarrollar sobre el sistema de diseño MOF.',
    navHome: 'Inicio',
    openMenu: 'Abrir o cerrar menú',
  },
  about: {
    brand: 'Qué somos',
    back: 'Volver al recorrido',
    scrollHint: 'Desliza o usa ← →',
    loading: 'Cargando espacio…',
    error: 'No se pudo iniciar la escena 3D',
    catalogCta: 'Ir al catálogo',
    sections: {
      hook: {
        name: 'Gancho',
        title: 'El universo en tus pantallas',
        body: 'Imaginen la posibilidad de explorar el universo como si estuviera en la palma de tu mano, o mejor dicho, en nuestras pantallas.',
        points: [],
      },
      background: {
        name: 'Antecedentes',
        title: 'SPHEREx y la escala del cielo',
        body: 'El satélite SPHEREx de la NASA explora el espacio desde 2025 mediante tecnología infrarroja.',
        points: [
          'Satélite SPHEREx (NASA): exploración infrarroja desde 2025',
          'Escala de datos: registro de más de miles de millones de cuerpos celestes',
        ],
      },
      problema: {
        name: 'Problema',
        title: 'Demasiados datos, poca accesibilidad',
        body: 'Existen demasiados datos y las herramientas actuales para analizarlos son complejas.',
        points: [
          'Exceso y complejidad: demasiado volumen y herramientas difíciles de usar',
          'Barrera de acceso: las imágenes astronómicas no son fáciles de interpretar para cualquier persona',
          'El reto (NASA Space Apps): desarrollar una herramienta web pública para visualizar y explorar cada parte del espacio',
        ],
      },
      historia: {
        name: 'Historia',
        title: 'Cómo se descubrió Plutón',
        body: 'El descubrimiento de Plutón se logró gracias a la comparación directa de imágenes astronómicas.',
        points: [
          'Metodología: al comparar dos capturas del mismo punto del espacio, se observó la firma espectral correspondiente a un planeta',
        ],
      },
      solucion: {
        name: 'Solución',
        title: 'Ciencia ciudadana con SPHEREx',
        body: 'Democratizar el acceso a los datos del cielo capturados por SPHEREx para impulsar descubrimientos comunitarios.',
        points: [
          'Impacto: aunque no se garantice bautizar una estrella o planeta con tu nombre, cualquier usuario puede ser parte de un gran hallazgo científico',
        ],
      },
      demo: {
        name: 'Demo',
        title: 'Exploración interactiva del cielo',
        body: 'El usuario navega por un campo virtual y busca o selecciona coordenadas específicas.',
        points: [
          'Análisis temporal: visualización del recorte temporal de ese sector del cielo para identificar nuevos cuerpos celestes o planetas',
        ],
      },
      futuro: {
        name: 'Futuro',
        title: 'Conclusiones y próximos pasos',
        body: 'Ampliar el alcance del visor con catálogos externos, inteligencia artificial y una comunidad más participativa.',
        points: [
          'Cruce de datos: identificar cuerpos celestes registrados y cruzar su ubicación con otros telescopios/visores (Gaia y WISE)',
          'Inteligencia artificial: predicción de nuevos cuerpos celestes mediante técnicas de IA',
          'Impacto cultural: fomentar una comunidad más culta y participativa en temas de astronomía',
        ],
      },
      alianzas: {
        name: 'Alianzas',
        title: 'Convenios y modelo sostenible',
        body: 'Construir alianzas estratégicas y una estructura que permita sostener el producto en el tiempo.',
        points: [
          'Convenios estratégicos: alianza con el Observatorio de Chacaltaya',
          'Modelo de negocio: estructura sostenible bajo el esquema SaaS (Software como Servicio)',
        ],
      },
      cierre: {
        name: 'Cierre',
        title: 'SCOUT · SPHEREx',
        body: 'El universo, en la palma de tu pantalla.',
        points: [],
      },
    },
  },
  catalog: {
    kicker: 'Guía de reconocimiento',
    title: 'Un catálogo para reconocer el cielo',
    lead: 'Cada cuerpo gira como se ve a distancia. Ábrelo para ver las señales que lo delatan, compararlo con una foto real y buscarlo en SPHEREx.',
    back: 'Volver',
    close: 'Cerrar',
    onboarding: 'Elige un cuerpo, compáralo con la foto real y salta al explorador.',
    onboardingDismiss: 'Entendido',
    far: 'De lejos',
    identify: 'Cómo identificarlo',
    identifyHint: 'Marca cada señal que veas.',
    identifyProgress: '{n} de {total}',
    traps: 'Trampas',
    compare: 'Comparar',
    compareGroup: 'Qué mostrar',
    compareModel: 'Animación 3D',
    comparePhoto: 'Foto real',
    credit: 'Crédito',
    license: 'Licencia',
    imageAdapted: 'adaptada (recorte y tamaño)',
    imageSource: 'Ver la imagen original',
    search: 'Buscar en SPHEREx',
    example: 'Ejemplo',
    ctaFixed: 'Ver {name} en el explorador',
    ctaEphemeris: 'Ver {name} el {date} en el explorador',
    ephemerisNote: 'La posición se calcula al hacer clic. Las imágenes de SPHEREx de esa zona se tomaron en otras fechas, así que Júpiter no tiene por qué aparecer en ellas: ya se movió. Ese desplazamiento es justamente lo que lo delata como planeta.',
    rows: {
      sky: 'En el cielo',
    },
    orb: {
      nebula: 'Animación de una nebulosa de emisión: nube de gas con filamentos, huecos oscuros y estrellas dentro',
      ring: 'Animación de una nebulosa planetaria: cáscara de gas en forma de anillo con una estrella en el centro',
      galaxy: 'Animación de una galaxia espiral inclinada: disco alargado con brazos azulados, núcleo amarillento y bandas de polvo',
      jupiter: 'Animación de Júpiter: planeta con bandas y la Gran Mancha Roja',
    },
  },
  routes: {
    explorer: 'Explorar',
    mission: 'Misión SPHEREx',
    home: 'Panel',
    about: 'Qué somos',
    catalog: 'Catálogo',
  },
}
