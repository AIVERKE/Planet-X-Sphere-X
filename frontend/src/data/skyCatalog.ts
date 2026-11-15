export type CatalogRow = 'sky' | 'yard'

export type CatalogShape = 'nebula' | 'ring' | 'galaxy' | 'jupiter'

export interface CatalogCopy {
  name: string
  blurb: string
  far: string
  identify: string
  traps: string[]
}

export interface CatalogEntry {
  id: string
  row: CatalogRow
  shape: CatalogShape
  colors: [string, string, string]
  es: CatalogCopy
  en: CatalogCopy
}

export const CATALOG_ROWS: CatalogRow[] = ['sky', 'yard']

export const SKY_CATALOG: CatalogEntry[] = [
  {
    id: 'emission',
    row: 'sky',
    shape: 'nebula',
    colors: ['#ffb15a', '#c43b78', '#6a4cff'],
    es: {
      name: 'Nebulosa',
      blurb: 'Gas encendido alrededor de estrellas jóvenes.',
      far: 'De lejos es una nube de filamentos, no una bola. El oro está donde el gas está más caliente; el violeta y el rosa, en el polvo más frío. En el ocular del patio se ve gris: esos colores piden una foto larga.',
      identify: 'Bordes irregulares, agujeros oscuros y estrellas metidas en la nube. No tiene un centro único ni un anillo limpio.',
      traps: [
        'Una farola fuera de foco es una mancha redonda y lisa. La nebulosa sigue a las estrellas si mueves el tubo.',
        'El teléfono no inventa estos filamentos con un zoom. Si solo salen al estirar la foto, es ruido.',
      ],
    },
    en: {
      name: 'Nebula',
      blurb: 'Gas lit up around young stars.',
      far: 'From afar it is a cloud of filaments, not a ball. Gold is the hotter gas; violet and pink are cooler dust. In a backyard eyepiece it looks gray: those colors need a long photo.',
      identify: 'Ragged edges, dark gaps, and stars embedded in the cloud. It has no single center and no clean ring.',
      traps: [
        'An out-of-focus streetlamp is a smooth round blob. The nebula stays with the stars if you nudge the tube.',
        'A phone zoom does not invent these filaments. If they appear only when you stretch the photo, they are noise.',
      ],
    },
  },
  {
    id: 'planetary',
    row: 'sky',
    shape: 'ring',
    colors: ['#d7fff2', '#3ec6c2', '#7a5cff'],
    es: {
      name: 'Nebulosa planetaria',
      blurb: 'Una cáscara de gas, no un planeta.',
      far: 'De lejos parece un anillo o una burbuja con un punto brillante en medio: la estrella que la soltó. El nombre solo dice que se ve redonda.',
      identify: 'Simetría. Un borde que se cierra y un centro más brillante. No se mueve de una noche a otra.',
      traps: [
        'Una estrella desenfocada también es un disco. Enfoca otra estrella: si el disco se vuelve punto, no era esta nebulosa.',
        'Júpiter es más grande, tiene bandas y lunas. Esto no.',
      ],
    },
    en: {
      name: 'Planetary nebula',
      blurb: 'A shell of gas, not a planet.',
      far: 'From afar it looks like a ring or a bubble with a bright point in the middle: the star that shed it. The name only means it looks round.',
      identify: 'Symmetry. An edge that closes, and a brighter center. It does not move from night to night.',
      traps: [
        'An out-of-focus star is also a disk. Focus another star: if the disk becomes a point, it was not this nebula.',
        'Jupiter is larger, with belts and moons. This has neither.',
      ],
    },
  },
  {
    id: 'galaxy',
    row: 'sky',
    shape: 'galaxy',
    colors: ['#f4efe4', '#9eb6ff', '#6a4a38'],
    es: {
      name: 'Galaxia espiral',
      blurb: 'Un disco de brazos, no una nube.',
      far: 'De lejos es un óvalo con brazos y un núcleo más brillante. Andrómeda, a ojo, es solo ese óvalo pálido. Los brazos salen en una foto larga.',
      identify: 'Forma de lente, más densa al centro, en un sitio fijo. No tiene los filamentos sueltos de una nebulosa.',
      traps: [
        'Una mancha que desaparece al enfocar es vaho o una huella.',
        'Un recorte ruidoso del móvil fabrica “brazos”. Tiene que verse también en otro encuadre.',
      ],
    },
    en: {
      name: 'Spiral galaxy',
      blurb: 'A disk of arms, not a cloud.',
      far: 'From afar it is an oval with arms and a brighter core. Andromeda, to the eye, is only that pale oval. The arms show up in a long photo.',
      identify: 'A lens shape, denser at the center, fixed on the sky. It does not have the loose filaments of a nebula.',
      traps: [
        'A smudge that vanishes when you refocus is fog or a fingerprint.',
        'A noisy phone crop invents “arms”. It has to show up in another frame too.',
      ],
    },
  },
  {
    id: 'jupiter',
    row: 'sky',
    shape: 'jupiter',
    colors: ['#e7d3a4', '#c47a45', '#f4efe6'],
    es: {
      name: 'Júpiter',
      blurb: 'Un disco con bandas, no una estrella.',
      far: 'De lejos es el punto brillante que no titila. Con un telescopio pequeño ya se ve este disco a rayas y, a veces, cuatro lunas en fila.',
      identify: 'Luz firme. Bandas horizontales y un óvalo pálido. Las lunas cambian de lado cada noche; el planeta también se mueve sobre las estrellas.',
      traps: [
        'Una estrella titila y no tiene escolta. Si los puntitos no se mueven en días, son estrellas de fondo.',
        'Un zoom del teléfono no resuelve las bandas. Una tormenta enorme y de colores de caramelo suele estar estirada.',
      ],
    },
    en: {
      name: 'Jupiter',
      blurb: 'A banded disk, not a star.',
      far: 'From afar it is the bright point that does not twinkle. A small telescope already shows this striped disk and, sometimes, four moons in a row.',
      identify: 'Steady light. Horizontal belts and a pale oval. The moons swap sides each night; the planet also shifts against the stars.',
      traps: [
        'A star twinkles and has no escort. If the dots do not move over days, they are background stars.',
        'A phone zoom does not resolve the belts. A huge candy-colored storm is usually a stretch.',
      ],
    },
  },
]
