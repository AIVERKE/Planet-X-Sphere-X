/** Destinos curados del cielo: reportes legibles + coords exactas (ICRS). */

export type SkyTarget = {
  id: string
  name: string
  aka?: string
  kind: 'nebula' | 'cluster' | 'galaxy' | 'region' | 'star' | 'brown-dwarf'
  ra: number
  dec: number
  /** Movimiento propio en AR·cos(Dec), mas/año (SIMBAD). Para la corrección por época (SPX-002). */
  pmra?: number
  /** Movimiento propio en Dec, mas/año (SIMBAD). */
  pmdec?: number
  /** Época (año juliano) de `ra`/`dec`. Sin valor = posición fija (objetos extensos). */
  epoch?: number
  /** FOV inicial “crudo” (grados) — contexto amplio, menos detalle. */
  fovWide: number
  /** FOV HD (grados) tras el acercamiento. */
  fovHd: number
  /** Radio SIA en arcsec para /api/observations. */
  obsRadius: number
  blurb: string
  report: string
}

export const SKY_TARGETS: SkyTarget[] = [
  {
    id: 'spherex-l2-demo',
    name: 'SPHEREx Level-2 (demo)',
    aka: '2025W33_2C_0321 · D6',
    kind: 'region',
    /** CRVAL del FITS IRSA level2_2025W33_2C_0321_1D6_… */
    ra: 268.339750167,
    dec: 3.58428436358,
    fovWide: 4,
    fovHd: 0.55,
    obsRadius: 90,
    blurb: 'Coords del FITS oficial IRSA; aquí sale en atlas + sellos + /api/observations.',
    report:
      'Este punto es el CRVAL del cutout Level-2 SPHEREx (obs_id 2025W33_2C_0321_1, banda D6). No hace falta bajar el FITS de ~16 MB: el backend lista el access_url/cutout_url y el frontend renderiza el cielo HD + sellos PanSTARRS en esas coordenadas.',
  },
  /*
   * Objetivos oficiales del reto (ids estables: se usan en `?target=`).
   * Posiciones ICRS de SIMBAD, sin propagar: SPX-002 las sustituirá por la posición
   * corregida por época usando `pmra` / `pmdec` / `epoch`.
   */
  {
    id: 'barnard',
    name: 'Estrella de Barnard',
    aka: 'GJ 699 · 1.83 pc',
    kind: 'star',
    ra: 269.452077,
    dec: 4.693365,
    pmra: -801.551,
    pmdec: 10362.394,
    epoch: 2000,
    fovWide: 1.5,
    fovHd: 0.3,
    obsRadius: 60,
    blurb: 'La estrella con mayor movimiento propio conocido (~10.4″/año).',
    report:
      'Enana roja a ~6 años luz, la estrella individual más cercana después del sistema α Centauri. Se desplaza ~10.4″ por año hacia el norte: entre épocas unWISE el salto es evidente. Posición J2000 (SIMBAD); la corrección por época llega con SPX-002.',
  },
  {
    id: 'eps_indi_b',
    name: 'ε Indi B',
    aka: 'Binaria de enanas marrones · 3.6 pc',
    kind: 'brown-dwarf',
    ra: 331.044147,
    dec: -56.782844,
    pmra: 3981.977,
    pmdec: -2466.832,
    epoch: 2000,
    fovWide: 1.5,
    fovHd: 0.3,
    obsRadius: 60,
    blurb: 'Par de enanas marrones que orbita a ε Indi A (~4.7″/año).',
    report:
      'ε Indi Ba y Bb son dos enanas marrones (T1 + T6) ligadas a la estrella ε Indi A, a ~12 años luz. Su movimiento propio de ~4.7″/año las hace ideales para el blink por épocas en infrarrojo. Posición J2000 (SIMBAD).',
  },
  {
    id: 'wise0855',
    name: 'WISE 0855−0714',
    aka: 'Enana marrón Y · 2.28 pc',
    kind: 'brown-dwarf',
    /** Posición de la designación WISE J085510.83−071442.5 (época ~2014, alineada con unWISE). */
    ra: 133.795129,
    dec: -7.245147,
    pmra: -8123.7,
    pmdec: 673.2,
    epoch: 2014,
    fovWide: 1.5,
    fovHd: 0.3,
    obsRadius: 90,
    blurb: 'La enana marrón más fría conocida, invisible en óptico.',
    report:
      'WISE 0855−0714 es la enana marrón más fría conocida (~250–285 K), a ~7.4 años luz. Casi no emite en óptico pero brilla en el infrarrojo medio. Su movimiento propio (~8.1″/año) se aprecia en el blink unWISE. Se usa la posición de su designación (época ~2014) en lugar de la J2000 de SIMBAD, que queda ~3.5′ desplazada.',
  },
  {
    id: 'rw_aur',
    name: 'RW Aurigae',
    aka: 'Estrella T Tauri · Tauro-Auriga',
    kind: 'star',
    ra: 76.956526,
    dec: 30.401438,
    pmra: 7.23,
    pmdec: -20.33,
    epoch: 2000,
    fovWide: 1.5,
    fovHd: 0.3,
    obsRadius: 60,
    blurb: 'Sistema joven con disco y oscurecimientos profundos.',
    report:
      'RW Aurigae es un sistema T Tauri joven con disco protoplanetario y episodios de oscurecimiento de varias magnitudes. Su variabilidad infrarroja la hace interesante para comparar épocas y bandas. Posición J2000 (SIMBAD).',
  },
  {
    id: 'r_dra',
    name: 'R Draconis',
    aka: 'Variable Mira',
    kind: 'star',
    ra: 248.167611,
    dec: 66.754979,
    pmra: -20.643,
    pmdec: 6.149,
    epoch: 2000,
    fovWide: 1.5,
    fovHd: 0.3,
    obsRadius: 60,
    blurb: 'Gigante roja pulsante con período de ~245 días.',
    report:
      'R Draconis es una variable tipo Mira: una gigante roja que pulsa con un período de ~245 días y cambia varias magnitudes de brillo. En infrarrojo cercano domina la emisión de su envolvente fría. Posición J2000 (SIMBAD).',
  },
  {
    id: 'orion',
    name: 'Nebulosa de Orión',
    aka: 'M42',
    kind: 'nebula',
    ra: 83.8221,
    dec: -5.3911,
    fovWide: 5,
    /** ~1.8° enmarca M42 + Trapecio sin “quemar” el núcleo. */
    fovHd: 1.8,
    obsRadius: 180,
    blurb: 'Vivero estelar más cercano, visible a simple vista.',
    report:
      'M42 es una nube de gas y polvo a ~1.344 a.l. donde nacen estrellas. SPHEREx la barre en infrarrojo cercano (0.75–5 μm), revelando polvo caliente y protoestrellas ocultas en óptico.',
  },
  {
    id: 'lagoon',
    name: 'Nebulosa Laguna',
    aka: 'M8',
    kind: 'nebula',
    ra: 270.904,
    dec: -24.3867,
    fovWide: 6,
    fovHd: 0.8,
    obsRadius: 180,
    blurb: 'Emisión H II brillante en Sagitario.',
    report:
      'La Laguna (M8) es una región H II masiva en el brazo de Sagitario. En IR, el polvo y las estrellas jóvenes dominan el contraste frente al fondo galáctico.',
  },
  {
    id: 'eagle',
    name: 'Nebulosa del Águila',
    aka: 'M16 · Pilares de la Creación',
    kind: 'nebula',
    ra: 274.7,
    dec: -13.8067,
    fovWide: 5,
    fovHd: 0.7,
    obsRadius: 160,
    blurb: 'Famosa por los pilares de gas interestelar.',
    report:
      'M16 alberga los Pilares de la Creación. SPHEREx aporta espectroscopía multi-banda útil para mapear hielo y polvo a lo largo de la línea de visión.',
  },
  {
    id: 'carina',
    name: 'Nebulosa de Carina',
    aka: 'NGC 3372',
    kind: 'nebula',
    ra: 161.265,
    dec: -59.6845,
    fovWide: 10,
    fovHd: 1.4,
    obsRadius: 240,
    blurb: 'Gigante del hemisferio sur, hogar de η Carinae.',
    report:
      'Carina es una de las nebulosas más energéticas de la Vía Láctea. El IR cercano penetra el polvo y muestra la estructura de la cavidad excavada por vientos estelares.',
  },
  {
    id: 'helix',
    name: 'Nebulosa Hélice',
    aka: 'NGC 7293',
    kind: 'nebula',
    ra: 337.4107,
    dec: -20.8371,
    fovWide: 4,
    fovHd: 0.55,
    obsRadius: 120,
    blurb: 'Nebulosa planetaria cercana (“ojo de Dios”).',
    report:
      'La Hélice es una nebulosa planetaria a ~650 a.l. Ideal para contrastar la vista “píxel” de un cutout con el atlas HD continuo de Aladin.',
  },
  {
    id: 'crab',
    name: 'Nebulosa del Cangrejo',
    aka: 'M1',
    kind: 'nebula',
    ra: 83.6331,
    dec: 22.0145,
    fovWide: 3,
    fovHd: 0.35,
    obsRadius: 90,
    blurb: 'Remanente de supernova del año 1054.',
    report:
      'M1 es el remanente de una supernova histórica. SPHEREx puede aportar contexto multi-banda alrededor del púlsar y el material eyectado.',
  },
  {
    id: 'rho-oph',
    name: 'Nube de Rho Ophiuchi',
    aka: 'ρ Oph',
    kind: 'region',
    ra: 246.7708,
    dec: -24.6789,
    fovWide: 8,
    fovHd: 1.2,
    obsRadius: 200,
    blurb: 'Complejo de formación estelar rico en polvo.',
    report:
      'Rho Ophiuchi es un laboratorio de formación estelar. En IR el polvo opaco se vuelve brillante: perfecto para mostrar el salto de vista cruda → HD.',
  },
  {
    id: 'wise-0855',
    name: 'WISE 0855',
    aka: 'RA 133.7951 · Dec −7.2451',
    kind: 'region',
    ra: 133.7951,
    dec: -7.2451,
    fovWide: 2.4,
    fovHd: 0.2,
    obsRadius: 90,
    blurb: 'Enana marrón cercana. Video SPHEREx de varias épocas.',
    report:
      'WISE 0855−0714 es una enana marrón fría a unos 7 años luz. En Movimiento el reproductor arma un video con los cutouts SPHEREx de un detector (D1–D6), ordenados por fecha. Comparar con WISE deja el blink unWISE como vista secundaria.',
  },
  {
    id: 'wiseview-demo',
    name: 'Campo WiseView (demo)',
    aka: 'RA 133.79 · Dec −8.24',
    kind: 'region',
    ra: 133.786245,
    dec: -8.244372,
    fovWide: 3.2,
    /** ~0.35° ≈ contexto HD; 176″ (~0.049°) es el zoom pixeleado de WiseView. */
    fovHd: 0.35,
    obsRadius: 120,
    blurb: 'Campo WiseView. SPHEREx es el video; unWISE queda en Comparar con WISE.',
    report:
      'Coords del laboratorio WiseView (133.786245, −8.244372). Movimiento abre el reproductor SPHEREx. Comparar con WISE conserva el blink unWISE (NEO2…NEO11) y las bandas PanSTARRS.',
  },
]

export function skyTargetById(id: string): SkyTarget | undefined {
  return SKY_TARGETS.find((t) => t.id === id)
}
