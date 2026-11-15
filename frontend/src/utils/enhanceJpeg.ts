/**
 * Agranda y suaviza un JPEG (WISE / foto fija) para el panel HD.
 * No inventa detalle: solo evita el aspecto a bloques.
 */
export async function enhanceJpegToHd(
  src: string,
  {
    scale = 3,
  }: {
    scale?: number
  } = {},
): Promise<string> {
  const image = await loadImage(src)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('No canvas')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, width, height)

  // Un toque de contraste suave: el IR plano se lee mejor.
  const shot = ctx.getImageData(0, 0, width, height)
  const data = shot.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lift(data[i]!)
    data[i + 1] = lift(data[i + 1]!)
    data[i + 2] = lift(data[i + 2]!)
  }
  ctx.putImageData(shot, 0, 0)

  return await canvasToUrl(canvas)
}

function lift(value: number): number {
  const n = value / 255
  const curved = Math.pow(n, 0.92)
  return Math.max(0, Math.min(255, Math.round(curved * 255)))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo mejorar la imagen'))
    image.src = src
  })
}

function canvasToUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo exportar HD'))
          return
        }
        resolve(URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.92,
    )
  })
}
