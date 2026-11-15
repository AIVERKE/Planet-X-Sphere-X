# Frontend — SCOUT · SPHEREx (Vue 3)

Vue 3 + Vite + TypeScript app: immersive explorer, catalog, About, and SPHEREx sky atlas.

The API lives in `backend/` (see [`../backend/README.md`](../backend/README.md) and the root [`../README.md`](../README.md)).

## Start

```bash
cd frontend
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. Set `VITE_API_URL=http://localhost:8000` in `.env` so the atlas can reach the API.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest |

## Layout (high level)

```
src/
  assets/          # images, fonts, audio
  components/      # explorer, mission, about, common UI
  composables/     # shared reactive logic
  data/            # planets, chapters, catalog, presets copy
  i18n/            # EN / ES messages (default: English)
  router/          # routes
  services/        # HTTP / Aladin helpers
  stores/          # Pinia
  three/           # WebGL scene modules
  views/           # pages
  App.vue
  main.ts
```

## Notes

- Default UI language is **English**; use the language toggle for Spanish.
- Atlas route: `/mision` (alias `/mission`).
- Branding: **SCOUT · SPHEREx**.
