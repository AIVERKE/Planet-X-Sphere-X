/** MOF design tokens — source of truth for colors, charts, and theme values. */

export const THEME_COLORS = {
  petroleum: '#1A4756',
  turquoise: '#028191',
  coral: '#F04D65',
  steelBlue: '#3C6893',
  emerald: '#2E8B57',
  danger: '#D93852',
  ivory: '#F7F5F1',
  surface: '#FFFFFF',
  ink: '#1A2A32',
} as const

/** Official chart series order (do not reorder). */
export const SERIES_COLORS = [
  THEME_COLORS.petroleum,
  THEME_COLORS.turquoise,
  THEME_COLORS.coral,
  THEME_COLORS.steelBlue,
  THEME_COLORS.emerald,
] as const

/** Solo 2 tipografías de texto en el proyecto: Urbanist (UI) y Outfit (explorador). */
export const FONT_FAMILY = {
  ui: '"Urbanist", system-ui, sans-serif',
  explorer: '"Outfit", system-ui, sans-serif',
} as const

export const RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
} as const
