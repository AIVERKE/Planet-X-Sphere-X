/**
 * Render HD del sistema (panel derecho).
 * Misma época que el satélite, pero más grande, con color y más nítida.
 * No convierte a gris ni difumina de más: eso hacía que se viera peor que la izquierda.
 */

export async function enhanceJpegToHd(
  src: string,
  {
    scale = 3,
  }: {
    scale?: number
  } = {},
): Promise<string> {
  const { image, revoke } = await loadImageSafe(src)
  try {
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('No canvas')

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, width, height)

    // Solo el panel derecho: suaviza el píxel del satélite sin tocar la foto cruda.
    const softCanvas = document.createElement('canvas')
    softCanvas.width = width
    softCanvas.height = height
    const sctx = softCanvas.getContext('2d', { alpha: false })
    if (!sctx) throw new Error('No soft canvas')
    sctx.filter = 'blur(1.15px)'
    sctx.drawImage(canvas, 0, 0)
    sctx.filter = 'none'

    ctx.globalAlpha = 0.35
    ctx.drawImage(canvas, 0, 0)
    ctx.globalAlpha = 0.65
    ctx.drawImage(softCanvas, 0, 0)
    ctx.globalAlpha = 1

    const shot = ctx.getImageData(0, 0, width, height)
    const data = shot.data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp((data[i]! - 8) * 1.08 + 8)
      data[i + 1] = clamp((data[i + 1]! - 8) * 1.08 + 8)
      data[i + 2] = clamp((data[i + 2]! - 8) * 1.08 + 8)
    }
    ctx.putImageData(shot, 0, 0)

    return await canvasToUrl(canvas)
  } finally {
    revoke()
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

async function loadImageSafe(src: string): Promise<{ image: HTMLImageElement; revoke: () => void }> {
  const response = await fetch(src, { mode: 'cors', credentials: 'omit' })
  if (!response.ok) throw new Error(`HD fetch HTTP ${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/') && blob.size < 64) {
    throw new Error('HD: respuesta no imagen')
  }
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen HD'))
      img.src = objectUrl
    })
    return {
      image,
      revoke: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
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
      0.94,
    )
  })
}
