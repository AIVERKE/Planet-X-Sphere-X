import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Config propia para tests: evita cargar los plugins de Vuetify/Tailwind de vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
