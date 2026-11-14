import { Vector3, type Camera } from 'three'

interface ProjectedEntry {
  el: HTMLElement
  getPosition: () => Vector3
  isActive: () => boolean
}

const entries = new Map<string, Partial<ProjectedEntry>>()
const world = new Vector3()
const direction = new Vector3()
const forward = new Vector3()
const ndc = new Vector3()

export function bindProjectedElement(id: string, el: HTMLElement, isActive: () => boolean) {
  const current = entries.get(id) ?? {}
  current.el = el
  current.isActive = isActive
  entries.set(id, current)
}

export function bindProjectedPoint(id: string, getPosition: () => Vector3) {
  const current = entries.get(id) ?? {}
  current.getPosition = getPosition
  entries.set(id, current)
}

export function unbindProjectedElement(id: string) {
  const current = entries.get(id)
  if (!current) return
  current.el = undefined
  current.isActive = undefined
  if (!current.getPosition) entries.delete(id)
}

export function updateProjected(camera: Camera, width: number, height: number) {
  camera.getWorldDirection(forward)

  for (const entry of entries.values()) {
    if (!entry.el || !entry.getPosition || !entry.isActive) continue
    if (!entry.isActive()) {
      entry.el.style.opacity = '0'
      continue
    }

    world.copy(entry.getPosition())
    direction.copy(world).sub(camera.position)
    const facing = direction.dot(forward) > 0.2
    ndc.copy(world).project(camera)
    const x = (ndc.x * 0.5 + 0.5) * width
    const y = (-ndc.y * 0.5 + 0.5) * height
    const onScreen = ndc.z < 1 && x > -80 && x < width + 80 && y > -80 && y < height + 80
    entry.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    entry.el.style.opacity = facing && onScreen ? '1' : '0'
  }
}
