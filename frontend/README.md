# Frontend MOF (Vue 3)

Aplicación **solo frontend** con Vue 3, Vite, TypeScript, Vue Router, Pinia y Vuetify, alineada al sistema de diseño MOF.

## Arranque

```bash
cd frontend
npm install
npm run dev
```

## Estructura

```
src/
  assets/          # imágenes, iconos, fuentes
  components/
    common/        # piezas reutilizables de dominio
    layout/        # header, sidebar, shells
    ui/            # botones, chips y controles MOF
  composables/     # lógica reactiva reutilizable
  config/          # designSystem.ts (tokens maestros)
  layouts/         # layouts de página
  plugins/         # vuetify, pinia, registro
  router/          # rutas
  services/        # clientes HTTP / integraciones
  stores/          # Pinia
  types/           # tipos compartidos
  utils/           # helpers puros
  views/           # páginas / pantallas
  App.vue
  main.ts
  style.css        # capas globales y clases semánticas MOF
```

## Diseño MOF

- Tokens: `src/config/designSystem.ts`
- Clases semánticas: `src/style.css` (`btn-*`, `chip-*`)
- Tema Vuetify: `src/plugins/vuetify.ts`
