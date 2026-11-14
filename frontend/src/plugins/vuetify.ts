import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { THEME_COLORS, FONT_FAMILY } from '@/config/designSystem'

export default createVuetify({
  theme: {
    defaultTheme: 'mofLight',
    themes: {
      mofLight: {
        dark: false,
        colors: {
          primary: THEME_COLORS.petroleum,
          secondary: THEME_COLORS.turquoise,
          accent: THEME_COLORS.coral,
          error: THEME_COLORS.danger,
          info: THEME_COLORS.steelBlue,
          success: THEME_COLORS.emerald,
          background: THEME_COLORS.ivory,
          surface: THEME_COLORS.surface,
        },
      },
    },
  },
  defaults: {
    VBtn: {
      rounded: 'md',
      style: { fontFamily: FONT_FAMILY.ui, textTransform: 'none', letterSpacing: '0' },
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
    },
  },
})
