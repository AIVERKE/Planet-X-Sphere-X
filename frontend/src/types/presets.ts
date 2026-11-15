export type PresetCategory = 'official_test' | 'survey_field'

/** Ubicación servida por GET /api/presets. ra/dec ya pueden venir propagadas. */
export interface PresetLocation {
  id: string
  name: string
  ra: number
  dec: number
  radius_deg: number
  description: string
  category: PresetCategory
  object_type: string
  pm_ra: number | null
  pm_dec: number | null
  /** Época de ra/dec (año decimal). 2025.5 si el API propagó el movimiento propio. */
  epoch: number
  fov_deg: number
  highlight: string
  catalog_ra: number | null
  catalog_dec: number | null
  catalog_epoch: number | null
}
