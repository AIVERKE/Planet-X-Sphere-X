import type { Messages } from '@/i18n/types'

export const es: Messages = {
  lang: {
    switchTo: 'English',
    switchToShort: 'EN',
    current: 'ES',
    aria: 'Traducir a inglés',
  },
  brand: 'Planet X and SPHEREx',
  nav: {
    landscape: 'Paisaje',
    world: 'Mundo',
    space: 'Espacio',
    explore: 'Explorar',
    spherex: 'SPHEREx',
    about: 'Qué somos',
    menu: 'Menú',
    close: 'Cerrar',
  },
  look: {
    loading: 'Cargando paisaje…',
    lookingSky: 'Mantén la vista al cielo 2 segundos…',
    dragHint: 'Arrastra para mirar · mira arriba al cielo para ascender',
    ascend: 'Ascender al espacio',
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
    mission: 'Planet X and SPHEREx',
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
    openLine2: 'Planet X and SPHEREx',
    openTitle: 'Abrir explorador Aladin Lite (carga diferida)',
    probeAlt: 'Sonda espacial SPHEREx de reflector metálico',
  },
  mission: {
    eyebrow: 'Misión · Planet X and SPHEREx',
    title: 'Espacio exterior',
    back: 'Volver al recorrido',
    loading: 'Cargando Aladin Lite…',
    errorTitle: 'No se pudo iniciar el explorador',
    errorFallback: 'No se pudo cargar Aladin Lite',
    retry: 'Reintentar',
    hint: 'Arrastra para explorar · rueda para acercar (tiles HiPS infinitos)',
    aladinAria: 'Explorador Aladin Lite',
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
    scrollHint: 'Desliza para continuar',
    loading: 'Cargando espacio…',
    error: 'No se pudo iniciar la escena 3D',
    sections: {
      vision: {
        name: 'Visión',
        title: 'Un visor público del cielo SPHEREx',
        body: 'Convertimos el mapa infrarrojo de la NASA en una experiencia que cualquiera puede explorar: sin astronomía previa ni código.',
        points: [
          '102 bandas del infrarrojo cercano (0,75–5,0 µm)',
          'Todo el cielo cada seis meses',
          'Más de mil millones de objetos',
        ],
      },
      proposito: {
        name: 'Propósito',
        title: 'Busca una región. Mira cómo cambia.',
        body: 'Introduce coordenadas o el nombre de un objeto, elige el campo de visión y reproduce las épocas como un video corto. Los objetos que se mueven o cambian de brillo saltan a la vista.',
        points: [
          'Consultas por URL compartibles',
          'Inspirado en WiseView y ciencia ciudadana',
          'Validado con los 5 objetivos del reto NASA',
        ],
      },
      problema: {
        name: 'Problema',
        title: 'Demasiados datos para verlos a mano',
        body: 'SPHEREx genera un volumen imposible de revisar a simple vista. Hoy hace falta software especializado: el público queda fuera, justo quien podría descubrir más.',
        points: [
          'FITS pesados y latencia alta',
          'Poca integración temporal ligera',
          '102 bandas difíciles de interpretar sin procesar',
        ],
      },
      solucion: {
        name: 'Solución',
        title: 'API abierta + recortes bajo demanda',
        body: 'FastAPI + Astropy + Astroquery consultan IRSA, filtran épocas y piden solo el recorte del cielo que necesitas. Caché, falso color, blinking y Aladin Lite para confirmar.',
        points: [
          'Metadatos y enlaces, no FITS completos',
          'Suma, resta y espectro al vuelo',
          'Gaia y WISE sobre SPHEREx',
        ],
      },
      impacto: {
        name: 'Impacto',
        title: 'Ciencia ciudadana desde Bolivia',
        body: 'Software libre y datos públicos, en el navegador, con costo mínimo. Pensado para colegios, universidades y clubes de astronomía de la región.',
        points: [
          'Español e inglés',
          'Modo guiado tipo detective',
          'Replicable sin infraestructura cara',
        ],
      },
      futuro: {
        name: 'Futuro',
        title: 'Demo en menos de un minuto',
        body: 'Backend FastAPI listo. La hoja de ruta cierra el frontend, caché de recortes, diferencias, espectros y catálogos. Éxito: ver movimiento y variabilidad sin ser astrónomo.',
        points: [
          'Reproductor + FOV + URL',
          'Imágenes de diferencia',
          'Flags de calidad visibles',
        ],
      },
    },
  },
  routes: {
    explorer: 'Explorar',
    mission: 'Misión SPHEREx',
    home: 'Panel',
    about: 'Qué somos',
  },
}
