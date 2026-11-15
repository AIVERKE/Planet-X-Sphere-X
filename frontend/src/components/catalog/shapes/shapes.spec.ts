import { describe, expect, it } from 'vitest'
import { Color, Mesh, Points, ShaderMaterial, Texture, type Object3D } from 'three'
import { SHAPE_BUILDERS } from './index'
import type { ShapeContext } from './types'

const PARTICLE_BUDGET = 20_000

function fakeContext() {
  const kept = new Set<unknown>()
  const ctx: ShapeContext = {
    keep: (item) => {
      kept.add(item)
      return item
    },
    colors: [new Color('#ffb15a'), new Color('#c43b78'), new Color('#6a4cff')],
    time: { value: 0 },
    pointScale: { value: 1 },
    loadTexture: () => new Texture(),
    invalidate: () => {},
  }
  return { ctx, kept }
}

function gpuResources(root: Object3D) {
  const resources = new Set<unknown>()
  root.traverse((node) => {
    if (!(node instanceof Mesh || node instanceof Points)) return
    resources.add(node.geometry)
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of materials) {
      resources.add(material)
      if (!(material instanceof ShaderMaterial)) continue
      for (const uniform of Object.values(material.uniforms)) {
        if (uniform.value instanceof Texture) resources.add(uniform.value)
      }
    }
  })
  return resources
}

function particleCount(root: Object3D) {
  let count = 0
  root.traverse((node) => {
    if (node instanceof Points) count += node.geometry.getAttribute('position').count
  })
  return count
}

function poses(root: Object3D) {
  const values: number[] = []
  root.traverse((node) => values.push(node.rotation.x, node.rotation.y, node.rotation.z))
  return values
}

describe('SHAPE_BUILDERS', () => {
  it('cubre exactamente las 4 formas del catálogo (sin craft)', () => {
    expect(Object.keys(SHAPE_BUILDERS).sort()).toEqual(['galaxy', 'jupiter', 'nebula', 'ring'])
  })
})

describe.each(Object.entries(SHAPE_BUILDERS))('%s', (_name, builder) => {
  it('registra con keep() toda geometría, material y textura', () => {
    const { ctx, kept } = fakeContext()
    const resources = gpuResources(builder(ctx).object)
    expect(resources.size).toBeGreaterThan(0)
    for (const resource of resources) expect(kept.has(resource)).toBe(true)
  })

  it(`usa como máximo ${PARTICLE_BUDGET} partículas`, () => {
    const { ctx } = fakeContext()
    expect(particleCount(builder(ctx).object)).toBeLessThanOrEqual(PARTICLE_BUDGET)
  })

  it('update(t) fija una pose absoluta (el cuadro estático es reproducible)', () => {
    const { ctx } = fakeContext()
    const build = builder(ctx)
    build.update(12)
    const first = poses(build.object)
    build.update(3)
    build.update(12)
    expect(poses(build.object)).toEqual(first)
  })
})
