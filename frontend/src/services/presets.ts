/** Ubicaciones predefinidas del cielo servidas por el backend (`GET /api/presets`). */

import { httpGet } from './http'
import type { PresetLocation } from '@/types/presets'

export function getPresets(init?: RequestInit): Promise<PresetLocation[]> {
  return httpGet<PresetLocation[]>('/api/presets', init)
}
