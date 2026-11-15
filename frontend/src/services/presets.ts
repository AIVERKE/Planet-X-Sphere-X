/** Ubicaciones predefinidas del cielo (`GET /api/presets`). */

import { httpGet } from './http'
import type { PresetLocation } from '@/types/presets'

export function getPresets(
  opts?: { epoch?: number; category?: string },
  init?: RequestInit,
): Promise<PresetLocation[]> {
  const params = new URLSearchParams()
  if (opts?.epoch != null) params.set('epoch', String(opts.epoch))
  if (opts?.category) params.set('category', opts.category)
  const query = params.toString()
  return httpGet<PresetLocation[]>(`/api/presets${query ? `?${query}` : ''}`, init)
}
