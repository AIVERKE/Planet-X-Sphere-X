import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  assetsInclude: ['**/*.exr'],
  optimizeDeps: {
    exclude: ['aladin-lite'],
  },
  build: {
    // Aladin Lite es un chunk aparte (solo se pide en /mision).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('aladin-lite')) return 'aladin-lite'
        },
      },
    },
  },
})
