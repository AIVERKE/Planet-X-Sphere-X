export interface PresetLocation {
  id: string
  name: string
  /** Ascensión recta (grados, ICRS) */
  ra: number
  /** Declinación (grados, ICRS) */
  dec: number
  /** Radio sugerido en grados. Para Aladin: setFov(radius_deg * 2) */
  radius_deg: number
  description: string
}
