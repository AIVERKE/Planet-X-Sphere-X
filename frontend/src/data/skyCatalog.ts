import m42Url from '@/assets/images/catalog/m42.webp'
import m57Url from '@/assets/images/catalog/m57.webp'
import m31Url from '@/assets/images/catalog/m31.webp'
import jupiterUrl from '@/assets/images/catalog/jupiter.webp'

export type CatalogRow = 'sky'

export type CatalogShape = 'nebula' | 'ring' | 'galaxy' | 'jupiter'

export type EphemerisBody = 'Jupiter'

/**
 * Destino en el explorador (`/mision`).
 * - `fixed`: RA/Dec J2000 en grados (objetos de cielo profundo).
 * - `ephemeris`: posición calculada en el momento del clic (cuerpos del Sistema Solar).
 */
export type MissionLink =
  | { kind: 'fixed'; ra: number; dec: number; fov: number }
  | { kind: 'ephemeris'; body: EphemerisBody; fov: number }

/** Foto real de referencia (WebP local, sin descargas en runtime). */
export interface CatalogReference {
  src: string
  /** Crédito oficial, tal cual lo pide la fuente. */
  credit: string
  license: string
  /** Página de la imagen en la fuente, para verificar crédito y licencia. */
  page: string
}

export interface CatalogCopy {
  name: string
  blurb: string
  far: string
  /** Señales cortas y comprobables (mínimo 3). */
  identify: string[]
  traps: string[]
  example: { name: string }
  /** Texto alternativo de la foto de referencia. */
  imageAlt: string
}

export interface CatalogEntry {
  id: string
  row: CatalogRow
  shape: CatalogShape
  colors: [string, string, string]
  reference: CatalogReference
  missionLink: MissionLink
  es: CatalogCopy
  en: CatalogCopy
}

export const CATALOG_ROWS: CatalogRow[] = ['sky']

export const SKY_CATALOG: CatalogEntry[] = [
  {
    id: 'emission',
    row: 'sky',
    shape: 'nebula',
    // Paleta de la foto de referencia: núcleo cálido, rosa del hidrógeno, púrpura tenue.
    colors: ['#ffd2b0', '#e0457b', '#6b3fa0'],
    reference: {
      src: m42Url,
      credit:
        'NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team · ESA/Hubble',
      license: 'CC BY 4.0',
      page: 'https://esahubble.org/images/heic0601a/',
    },
    missionLink: { kind: 'fixed', ra: 83.8221, dec: -5.3911, fov: 1.0 },
    es: {
      name: 'Nebulosa de emisión',
      blurb: 'Gas encendido alrededor de estrellas jóvenes.',
      far: 'De lejos es una nube de filamentos, no una bola. El oro está donde el gas está más caliente; el violeta y el rosa, en el polvo más frío. En el ocular se ve gris: esos colores piden una foto larga.',
      identify: [
        'Bordes deshilachados, sin un contorno que se cierre.',
        'Zonas oscuras de polvo que cortan la nube.',
        'Estrellas brillantes metidas dentro de la nube (en M42, el Trapecio).',
        'En las fotos domina el rojo o el rosa del hidrógeno.',
      ],
      traps: [
        'Una farola fuera de foco es una mancha redonda y lisa. La nebulosa sigue a las estrellas si mueves el tubo.',
        'El teléfono no inventa estos filamentos con un zoom. Si solo salen al estirar la foto, es ruido.',
        'Una galaxia también es una mancha difusa, pero es un óvalo con un solo núcleo brillante. La nebulosa no tiene un centro único.',
      ],
      example: { name: 'Nebulosa de Orión (M42)' },
      imageAlt:
        'Nebulosa de Orión fotografiada por el Hubble: nubes rosadas y rojizas con filamentos, franjas oscuras de polvo y estrellas brillantes en el centro.',
    },
    en: {
      name: 'Emission nebula',
      blurb: 'Gas lit up around young stars.',
      far: 'From afar it is a cloud of filaments, not a ball. Gold is the hotter gas; violet and pink are cooler dust. In an eyepiece it looks gray: those colors need a long photo.',
      identify: [
        'Ragged edges, with no outline that closes.',
        'Dark dust lanes cutting through the cloud.',
        'Bright stars embedded in the cloud (in M42, the Trapezium).',
        'In photos, the red or pink of hydrogen dominates.',
      ],
      traps: [
        'An out-of-focus streetlamp is a smooth round blob. The nebula stays with the stars if you nudge the tube.',
        'A phone zoom does not invent these filaments. If they appear only when you stretch the photo, they are noise.',
        'A galaxy is also a fuzzy patch, but it is an oval with a single bright core. The nebula has no single center.',
      ],
      example: { name: 'Orion Nebula (M42)' },
      imageAlt:
        'The Orion Nebula seen by Hubble: pink and reddish clouds with filaments, dark dust lanes and bright stars at the center.',
    },
  },
  {
    id: 'planetary',
    row: 'sky',
    shape: 'ring',
    // Paleta de la foto de referencia: borde interior cian, cavidad azul, borde exterior naranja.
    colors: ['#c9f7e4', '#3f7fe0', '#ff7a2e'],
    reference: {
      src: m57Url,
      credit: "NASA, ESA, and C. Robert O'Dell (Vanderbilt University) · ESA/Hubble",
      license: 'CC BY 4.0',
      page: 'https://esahubble.org/images/heic1310a/',
    },
    missionLink: { kind: 'fixed', ra: 283.3963, dec: 33.0292, fov: 0.15 },
    es: {
      name: 'Nebulosa planetaria',
      blurb: 'Una cáscara de gas, no un planeta.',
      far: 'De lejos parece un anillo o una burbuja con un punto en medio: la estrella que la soltó. El nombre solo dice que se ve redonda.',
      identify: [
        'Forma redonda u ovalada, casi simétrica.',
        'Un borde que se cierra como un anillo o una burbuja.',
        'Una estrella tenue justo en el centro.',
        'Es diminuta: cabría muchas veces dentro de la Luna llena.',
      ],
      traps: [
        'Una estrella desenfocada también es un disco. Enfoca otra estrella: si el disco se vuelve punto, no era esta nebulosa.',
        'Júpiter también es un disco, pero es mucho más brillante, tiene bandas y lunas, y se mueve entre las estrellas.',
        'Una galaxia vista de frente es redonda, pero se ilumina hacia el centro, sin hueco.',
      ],
      example: { name: 'Nebulosa del Anillo (M57)' },
      imageAlt:
        'Nebulosa del Anillo fotografiada por el Hubble: un anillo naranja con el interior azul verdoso y una estrella tenue en el centro.',
    },
    en: {
      name: 'Planetary nebula',
      blurb: 'A shell of gas, not a planet.',
      far: 'From afar it looks like a ring or a bubble with a point in the middle: the star that shed it. The name only means it looks round.',
      identify: [
        'Round or oval, almost symmetric.',
        'An edge that closes like a ring or a bubble.',
        'A faint star right at the center.',
        'It is tiny: it would fit many times inside the full Moon.',
      ],
      traps: [
        'An out-of-focus star is also a disk. Focus another star: if the disk becomes a point, it was not this nebula.',
        'Jupiter is also a disk, but it is much brighter, has belts and moons, and moves against the stars.',
        'A face-on galaxy is round too, but it brightens toward the center, with no hole.',
      ],
      example: { name: 'Ring Nebula (M57)' },
      imageAlt:
        'The Ring Nebula seen by Hubble: an orange ring with a blue-green interior and a faint star at the center.',
    },
  },
  {
    id: 'galaxy',
    row: 'sky',
    shape: 'galaxy',
    colors: ['#f4efe4', '#9eb6ff', '#6a4a38'],
    reference: {
      src: m31Url,
      credit:
        'ESA/Hubble & Digitized Sky Survey 2. Acknowledgment: Davide De Martin (ESA/Hubble)',
      license: 'CC BY 4.0',
      page: 'https://esahubble.org/images/heic1112f/',
    },
    missionLink: { kind: 'fixed', ra: 10.6847, dec: 41.269, fov: 3.0 },
    es: {
      name: 'Galaxia espiral',
      blurb: 'Un disco de brazos, no una nube.',
      far: 'De lejos es un óvalo con brazos y un núcleo más brillante. Andrómeda, a ojo, es solo ese óvalo pálido. Los brazos salen en una foto larga.',
      identify: [
        'Un óvalo alargado con un núcleo más brillante en el centro.',
        'El brillo baja suave del centro hacia el borde, sin filamentos sueltos.',
        'Franjas oscuras de polvo que siguen la forma del disco.',
        'En fotos largas, brazos o anillos que rodean el núcleo.',
      ],
      traps: [
        'Una mancha que desaparece al enfocar es vaho o una huella.',
        'Un recorte ruidoso del móvil fabrica “brazos”. Tiene que verse también en otro encuadre.',
        'Un cometa también tiene el centro brillante, pero lleva cola y cambia de sitio de una noche a otra.',
      ],
      example: { name: 'Galaxia de Andrómeda (M31)' },
      imageAlt:
        'Galaxia de Andrómeda: un óvalo inclinado con un núcleo brillante, franjas de polvo y dos galaxias compañeras pequeñas.',
    },
    en: {
      name: 'Spiral galaxy',
      blurb: 'A disk of arms, not a cloud.',
      far: 'From afar it is an oval with arms and a brighter core. Andromeda, to the eye, is only that pale oval. The arms show up in a long photo.',
      identify: [
        'An elongated oval with a brighter core at the center.',
        'The glow fades smoothly from the center to the edge, with no loose filaments.',
        'Dark dust lanes that follow the shape of the disk.',
        'In long photos, arms or rings wrapping around the core.',
      ],
      traps: [
        'A smudge that vanishes when you refocus is fog or a fingerprint.',
        'A noisy phone crop invents “arms”. It has to show up in another frame too.',
        'A comet also has a bright center, but it has a tail and changes place from one night to the next.',
      ],
      example: { name: 'Andromeda Galaxy (M31)' },
      imageAlt:
        'The Andromeda Galaxy: a tilted oval with a bright core, dust lanes and two small companion galaxies.',
    },
  },
  {
    id: 'jupiter',
    row: 'sky',
    shape: 'jupiter',
    colors: ['#e7d3a4', '#c47a45', '#f4efe6'],
    reference: {
      src: jupiterUrl,
      credit:
        'NASA, ESA, A. Simon (Goddard Space Flight Center), and M.H. Wong (University of California, Berkeley) · ESA/Hubble',
      license: 'CC BY 4.0',
      page: 'https://esahubble.org/images/heic1914a/',
    },
    missionLink: { kind: 'ephemeris', body: 'Jupiter', fov: 0.5 },
    es: {
      name: 'Júpiter',
      blurb: 'Un disco con bandas, no una estrella.',
      far: 'De lejos es el punto brillante que no titila. Con un telescopio pequeño ya se ve este disco a rayas y, a veces, cuatro lunas en fila.',
      identify: [
        'Luz firme que no titila, más brillante que casi cualquier estrella.',
        'Con prismáticos o telescopio es un disco, no un punto, con bandas paralelas.',
        'Hasta cuatro puntitos en línea a sus lados: lunas que cambian de lado cada noche.',
        'Se desplaza entre las estrellas de una semana a otra.',
      ],
      traps: [
        'Una estrella titila y no tiene escolta. Si los puntitos no se mueven en días, son estrellas de fondo.',
        'Un zoom del teléfono no resuelve las bandas. Una tormenta enorme y de colores de caramelo suele estar estirada.',
        'Un avión también brilla mucho, pero parpadea con luces de colores y cruza el cielo en minutos.',
      ],
      example: { name: 'Júpiter hoy' },
      imageAlt:
        'Júpiter fotografiado por el Hubble: un disco con bandas crema y marrones y la Gran Mancha Roja.',
    },
    en: {
      name: 'Jupiter',
      blurb: 'A banded disk, not a star.',
      far: 'From afar it is the bright point that does not twinkle. A small telescope already shows this striped disk and, sometimes, four moons in a row.',
      identify: [
        'Steady light that does not twinkle, brighter than almost any star.',
        'Through binoculars or a telescope it is a disk, not a point, with parallel belts.',
        'Up to four dots in a line beside it: moons that swap sides each night.',
        'It shifts against the stars from one week to the next.',
      ],
      traps: [
        'A star twinkles and has no escort. If the dots do not move over days, they are background stars.',
        'A phone zoom does not resolve the belts. A huge candy-colored storm is usually a stretch.',
        'A plane is also bright, but it blinks with colored lights and crosses the sky in minutes.',
      ],
      example: { name: 'Jupiter today' },
      imageAlt:
        'Jupiter seen by Hubble: a disk with cream and brown belts and the Great Red Spot.',
    },
  },
]
