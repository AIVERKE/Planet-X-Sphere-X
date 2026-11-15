/// <reference types="node" />
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SKY_CATALOG } from './skyCatalog'

const MAX_ASSET_BYTES = 200 * 1024
const ASSET_DIR = fileURLToPath(new URL('../assets/images/catalog/', import.meta.url))

describe('integridad del catálogo', () => {
  it('tiene 4 entradas y ninguna es el satélite', () => {
    expect(SKY_CATALOG).toHaveLength(4)
    expect(SKY_CATALOG.map((e) => e.id)).toEqual(['emission', 'planetary', 'galaxy', 'jupiter'])
    for (const item of SKY_CATALOG) {
      expect(item.id).not.toBe('satellite')
      expect(item.shape as string).not.toBe('craft')
    }
  })

  it.each(SKY_CATALOG.map((e) => e.id))('%s: es/en completos y con las mismas claves', (id) => {
    const item = SKY_CATALOG.find((e) => e.id === id)!
    expect(Object.keys(item.es).sort()).toEqual(Object.keys(item.en).sort())

    for (const copy of [item.es, item.en]) {
      expect(copy.identify.length).toBeGreaterThanOrEqual(3)
      expect(copy.traps.length).toBeGreaterThanOrEqual(2)
      for (const text of [copy.name, copy.blurb, copy.far, copy.example.name, copy.imageAlt, ...copy.identify, ...copy.traps]) {
        expect(text.trim()).not.toBe('')
      }
    }
    // Checklist y trampas se traducen 1:1.
    expect(item.es.identify).toHaveLength(item.en.identify.length)
    expect(item.es.traps).toHaveLength(item.en.traps.length)
  })

  it.each(SKY_CATALOG.map((e) => e.id))('%s: imagen de referencia con crédito y licencia', (id) => {
    const { reference } = SKY_CATALOG.find((e) => e.id === id)!
    expect(reference.src).toMatch(/\.(webp|avif)$/)
    expect(reference.credit.trim()).not.toBe('')
    expect(reference.license.trim()).not.toBe('')
    expect(reference.page).toMatch(/^https:\/\//)
  })

  it('las imágenes de referencia pesan ≤ 200 KB y hay una por entrada', () => {
    const files = readdirSync(ASSET_DIR).filter((f) => /\.(webp|avif)$/.test(f))
    expect(files.length).toBe(SKY_CATALOG.length)
    for (const file of files) {
      expect(statSync(join(ASSET_DIR, file)).size, file).toBeLessThanOrEqual(MAX_ASSET_BYTES)
    }
    for (const item of SKY_CATALOG) {
      const name = item.reference.src.split('/').pop()?.split('?')[0]
      expect(files).toContain(name)
    }
  })
})
