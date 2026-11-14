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
    host: '127.0.0.1',
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // HiPS same-origin: evita CORS/proxy CDS roto → cielo negro en Aladin.
      // secure:false = Node en Windows a menudo no verifica la CA de ESA/IRSA.
      '/hips/esa-dss': {
        target: 'https://skies.esac.esa.int',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/hips\/esa-dss/, '/DSSColor'),
      },
      '/hips/irsa-dss': {
        target: 'https://irsa.ipac.caltech.edu',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/hips\/irsa-dss/, '/data/hips/CDS/DSS2/color'),
      },
      '/hips/irsa-2mass': {
        target: 'https://irsa.ipac.caltech.edu',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/hips\/irsa-2mass/, '/data/hips/CDS/2MASS/Color'),
      },
    },
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
