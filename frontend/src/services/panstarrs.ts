/**
 * Cutouts oficiales PanSTARRS-1 (STScI), mismos sellos que
 * https://ps1images.stsci.edu/cgi-bin/ps1cutouts
 */

export type Ps1Stamp = {
  id: string
  label: string
  filter: string
  jpegUrl: string
  fitsUrl: string
}

const PS1 = 'https://ps1images.stsci.edu'

function fitscutJpeg(opts: {
  red: string
  green?: string
  blue?: string
  ra: number
  dec: number
  size: number
}): string {
  const params = new URLSearchParams({
    red: opts.red,
    format: 'jpeg',
    x: String(opts.ra),
    y: String(opts.dec),
    size: String(opts.size),
    wcs: '1',
    asinh: '1',
    autoscale: '99.5',
  })
  if (opts.green) params.set('green', opts.green)
  if (opts.blue) params.set('blue', opts.blue)
  return `${PS1}/cgi-bin/fitscut.cgi?${params.toString()}`
}

function fitscutFits(file: string, ra: number, dec: number, size: number): string {
  const params = new URLSearchParams({
    red: file,
    format: 'fits',
    x: String(ra),
    y: String(dec),
    size: String(size),
    wcs: '1',
  })
  return `${PS1}/cgi-bin/fitscut.cgi?${params.toString()}`
}

export function panstarrsPortalUrl(ra: number, dec: number, size = 240): string {
  const params = new URLSearchParams({
    pos: `${ra} ${dec}`,
    filter: 'color',
    filetypes: 'stack',
    auxiliary: 'data',
    size: String(size),
    output_size: '0',
    verbose: '0',
    autoscale: '99.500000',
  })
  // El portal web marca color+g+r+i+z+y; enlazamos el mismo POS.
  return `${PS1}/cgi-bin/ps1cutouts?${params.toString()}&filter=g&filter=r&filter=i&filter=z&filter=y`
}

/** Resuelve filenames PS1 y arma JPEG/FITS cutouts (color + grizy). */
export async function fetchPanstarrsStamps(
  ra: number,
  dec: number,
  size = 240,
): Promise<Ps1Stamp[]> {
  const metaUrl = `${PS1}/cgi-bin/ps1filenames.py?ra=${ra}&dec=${dec}&filters=grizy`
  const res = await fetch(metaUrl)
  if (!res.ok) throw new Error(`PanSTARRS filenames HTTP ${res.status}`)
  const text = await res.text()
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('PanSTARRS no devolvió stacks en esta posición')

  const header = lines[0].split(/\s+/)
  const byFilter = new Map<string, string>()
  for (const line of lines.slice(1)) {
    const cols = line.split(/\s+/)
    const row: Record<string, string> = {}
    header.forEach((key, i) => {
      row[key] = cols[i] ?? ''
    })
    if (row.filter && row.filename) byFilter.set(row.filter, row.filename)
  }

  const order = ['g', 'r', 'i', 'z', 'y'] as const
  const stamps: Ps1Stamp[] = []

  const y = byFilter.get('y')
  const i = byFilter.get('i')
  const g = byFilter.get('g')
  if (y && i && g) {
    stamps.push({
      id: 'color',
      label: 'color y/i/g',
      filter: 'color',
      jpegUrl: fitscutJpeg({ red: y, green: i, blue: g, ra, dec, size }),
      fitsUrl: panstarrsPortalUrl(ra, dec, size),
    })
  }

  for (const f of order) {
    const file = byFilter.get(f)
    if (!file) continue
    stamps.push({
      id: f,
      label: f,
      filter: f,
      jpegUrl: fitscutJpeg({ red: file, ra, dec, size }),
      fitsUrl: fitscutFits(file, ra, dec, size),
    })
  }

  if (!stamps.length) throw new Error('Sin sellos PanSTARRS para estas coords')
  return stamps
}
