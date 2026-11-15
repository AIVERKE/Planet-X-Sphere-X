import type { CatalogShape } from '@/data/skyCatalog'
import { buildGalaxy } from './galaxy'
import { buildJupiter } from './jupiter'
import { buildNebula } from './nebula'
import { buildRing } from './ring'
import type { ShapeBuilder } from './types'

export const SHAPE_BUILDERS: Record<CatalogShape, ShapeBuilder> = {
  nebula: buildNebula,
  ring: buildRing,
  galaxy: buildGalaxy,
  jupiter: buildJupiter,
}

export type { ShapeBuild, ShapeContext } from './types'
