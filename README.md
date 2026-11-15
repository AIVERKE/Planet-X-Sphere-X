# SCOUT · SPHEREx

Monorepo for the NASA Space Apps project **SCOUT · SPHEREx**:

- **backend/** — Python **FastAPI** API (IRSA / SPHEREx queries, presets, PNG cutouts). PostgreSQL via SQLAlchemy 2.x is optional.
- **frontend/** — **Vue 3** + **Vite** + TypeScript immersive explorer and sky atlas.

Detailed backend install (Git Bash, PowerShell, macOS/Linux): see [`backend/README.md`](backend/README.md).

---

## Requirements

| Tool | Version |
|------|---------|
| Python | 3.11+ (3.13 recommended on Windows) |
| Node.js | 20.19+ LTS (or 22.12+) |
| npm | 10+ |
| PostgreSQL | 14+ (optional; only if you use DB-backed endpoints) |
| Git | Recent |

---

## Repository layout

```
Planet-X-Sphere-X/
├── backend/
│   ├── main.py            # FastAPI app, CORS, /health, routers
│   ├── database.py        # SQLAlchemy engine / SessionLocal from DATABASE_URL
│   ├── routers/           # Endpoints under /api
│   ├── models/            # ORM models
│   ├── schemas/           # Pydantic schemas
│   ├── requirements.txt
│   ├── README.md          # Full backend setup (English)
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── .env.example
└── README.md              # This file
```

---

## Quick start

### Backend (API on port 8000)

From the repo root, using **Git Bash** (Cursor default on Windows):

```bash
cd backend
py -3.13 -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -r requirements.txt
cp .env.example .env
./.venv/Scripts/python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**PowerShell** equivalent:

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- Health: http://127.0.0.1:8000/health → `{"status":"ok"}`
- Swagger: http://127.0.0.1:8000/docs

> Do **not** use `npm` inside `backend/`.  
> Full notes (venv activation, CORS, troubleshooting): [`backend/README.md`](backend/README.md).

#### Optional PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE planet_x;"
```

The API starts even if Postgres is down. Connection is lazy: only endpoints that hit the DB will fail without it. Set `DATABASE_URL` in `backend/.env` when needed.

#### Environment (`backend/.env`)

```env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/planet_x
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Frontend (UI on port 5173)

In a **second** terminal:

```bash
cd frontend
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

```env
VITE_API_URL=http://localhost:8000
```

Keep both processes running so the atlas can call the API (CORS must allow the Vite origin).

---

## Backend API overview

### Observations — `GET /api/observations`

Queries IRSA SIA v2 (`Irsa.query_sia`) and returns ObsCore metadata for images covering a sky position, filtered by epoch. **Does not download FITS**: each row includes `access_url` (full image) and `cutout_url` (IRSA cutout centered on the request).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ra` | float | required | Right ascension, ICRS degrees (`0 ≤ ra < 360`) |
| `dec` | float | required | Declination, ICRS degrees (`-90 ≤ dec ≤ 90`) |
| `radius` | float | `1.0` | Search radius in **arcseconds** (`0 < radius ≤ 3600`) |
| `t_start` | float | `0.0` | Lower bound on `t_min` (**MJD**) |
| `t_end` | float | `99999.0` | Upper bound on `t_max` (**MJD**) |
| `collection` | str | `spherex_dr1` | IRSA SIA collection (e.g. `spherex_dr1_deep`, `spherex_qr3`) |
| `cutout_size` | float | `0.05` | Cutout side length in degrees (`0 < size ≤ 1`) |
| `group_by_band` | bool | `false` | Group by `energy_bandpassname` (`SPHEREx-D1` … `SPHEREx-D6`) |

An image is kept only if its full exposure falls in the window (`t_min ≥ t_start` and `t_max ≤ t_end`). Results are sorted by `t_min`.

Example response (`group_by_band=false`):

```json
{
  "query": {"ra": 270.0, "dec": 66.56, "radius": 10.0, "t_start": 0.0, "t_end": 99999.0, "collection": "spherex_dr1", "cutout_size": 0.05},
  "count": 439,
  "observations": [
    {"obs_id": "2025W17_4B_0091_1", "energy_bandpassname": "SPHEREx-D5", "t_min": 60790.35, "t_max": 60790.35, "access_url": "https://irsa.ipac.caltech.edu/…fits", "cutout_url": "https://irsa.ipac.caltech.edu/…fits?center=270.0,66.56&size=0.05"}
  ]
}
```

With `group_by_band=true`, the payload uses `bands: {"SPHEREx-D1": [...], ...}` instead of `observations`. Missing values become `null`.

Errors: `404` no images / none in the time window; `422` invalid params (including `t_start > t_end`); `503` IRSA unreachable.

Example:

```text
http://127.0.0.1:8000/api/observations?ra=270&dec=66.56&radius=10
```

### Frames & PNG — `GET /api/observations/frames`, `GET /api/cutouts/png`

`/api/observations/frames` repeats the SIA query and returns epochs for **one detector**, sorted by `t_min`. If `band` is omitted, it picks the detector with the most epochs (tie-break: D1 before D2). At most 16 epochs are spread over time (`matched` = detector total, `returned` = in the response).

Each frame includes `obs_id`, `t_min`, `t_max`, `band` (`D1`…`D6`), and `png_url` pointing at `/api/cutouts/png?...`. That URL already carries shared `vmin` / `vmax`: the backend reprojects cutouts onto a common grid (north up, centered on the requested RA/Dec, 192×192) and computes zscale **once** from the stack median.

`/api/cutouts/png` downloads the FITS from IRSA, reads the `IMAGE` extension, and returns `image/png`. The browser never receives FITS bytes.

| Parameter | In `frames` | In `png` | Notes |
|-----------|-------------|----------|--------|
| `ra`, `dec`, `radius`, `t_start`, `t_end`, `collection`, `cutout_size` | yes | `ra`, `dec`, `size` | Same limits as `/api/observations`. `size` is side length in degrees. |
| `band` | optional | — | `D1`…`D6` or `SPHEREx-D1`…`D6` |
| `url` | — | required | Must be `https://irsa.ipac.caltech.edu/...`. Other hosts / `http` / off-IRSA redirects → **400**. |
| `vmin`, `vmax` | in response | optional | Shared stretch. If missing, PNG uses per-frame zscale. |

Downloaded FITS and PNGs are cached under `backend/.cache/cutouts/` (not versioned).

Errors: `400` non-IRSA URL; `404` no images / no epochs for that detector; `422` bad params or FITS without science image; `503` IRSA down.

### Backend tests

```bash
cd backend
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
./.venv/Scripts/python.exe -m pytest -q
```

Tests mock `Irsa.query_sia` and cutout downloads (no network required).

---

## Frontend atlas URL & embed

Mission atlas route: `/mision` (alias `/mission`). View state lives in the query string: opening a link centers the sky; pan/zoom updates the URL with `replace` (no history spam); F5 restores the view.

| Parameter | Format | Description |
|-----------|--------|-------------|
| `ra` | degrees `0–360` or sexagesimal hours: `08h55m10.8s`, `08:55:10.8` | Right ascension (ICRS). Always paired with `dec`. |
| `dec` | degrees `−90–90` or sexagesimal: `-7d14m42.5s`, `-07:14:42.5` | Declination (ICRS). |
| `fov` | degrees | Field of view, clamped roughly to `0.08–40`. |
| `target` | preset id | e.g. `barnard`, `eps_indi_b`, `wise0855`, `rw_aur`, `r_dra`, plus atlas fields (`orion`, `lagoon`, …). |
| `embed` | `1` | Compact iframe mode: atlas + epoch player + “Open in SCOUT” link. |

Initial position priority:

1. `ra` + `dec` from the URL  
2. `target`  
3. Default destination  

Invalid params are ignored (defaults + non-blocking notice). The URL is rewritten in canonical decimal form.

Examples:

```text
/mision?ra=133.7951&dec=-7.2451&fov=0.3
/mision?ra=08h55m10.831s&dec=-7d14m42.53s
/mision?target=wise0855
/mision?target=barnard&embed=1
```

**Share** copies the current link and an embed snippet:

```html
<iframe src="https://<your-domain>/mision?target=wise0855&amp;embed=1"
        width="800" height="500" style="border:0" loading="lazy"
        allow="clipboard-write" title="SCOUT · SPHEREx Atlas"></iframe>
```

> Official preset positions are static (SIMBAD J2000; WISE 0855 uses its designation epoch ~2014).  
> For embeds in production, avoid `X-Frame-Options: DENY` and restrictive `frame-ancestors` CSP.

### Frontend tests

```bash
cd frontend
npm run test
```

Vitest covers coordinate parsing/validation (`parseCoord`, `readFromQuery`) and URL writing.

---

## Conventions

- Code and documentation in **English**.
- Business routers mount under `/api`.
- Never commit `.env`; only `.env.example`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …).
