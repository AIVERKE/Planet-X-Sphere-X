# Backend — SCOUT · SPHEREx

FastAPI service that queries NASA IRSA (SPHEREx), serves sky presets, and renders PNG cutouts for the frontend atlas.

This is a **Python** project. Do **not** run `npm` commands here. The Vue app lives in `frontend/` (`npm run dev`).

---

## Requirements

| Tool | Notes |
|------|--------|
| **Python 3.11+** | **3.13 recommended** on Windows (`py -3.13`) |
| Git | Any shell: Git Bash, PowerShell, or macOS/Linux terminal |
| PostgreSQL | **Optional** — only if you use features that read `DATABASE_URL` |

Check Python:

```bash
py -3.13 --version
# or
python3 --version
```

---

## 1. One-time setup

Open a terminal and go to this folder:

```bash
cd backend
```

### Create a virtual environment

**Windows (Git Bash — typical in Cursor):**

```bash
py -3.13 -m venv .venv
```

**Windows (PowerShell):**

```powershell
py -3.13 -m venv .venv
```

**macOS / Linux:**

```bash
python3 -m venv .venv
```

### Install dependencies

Use the venv’s Python **directly** (works in every shell; no activation required).

**Windows (Git Bash):**

```bash
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -r requirements.txt
cp .env.example .env
```

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

### Configure `.env`

Edit `backend/.env` if needed:

| Variable | Purpose | Default idea |
|----------|---------|----------------|
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `DATABASE_URL` | PostgreSQL (optional) | See `.env.example` |

For local frontend + atlas, the defaults from `.env.example` are usually enough.

---

## 2. Start the API

Always run from `backend/`.

### Recommended (no venv activation)

**Windows (Git Bash):**

```bash
cd backend
./.venv/Scripts/python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Windows (PowerShell):**

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**macOS / Linux:**

```bash
cd backend
./.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

You should see something like:

```text
Uvicorn running on http://127.0.0.1:8000
Application startup complete.
```

Leave this terminal open while you use the app.

### Optional: activate the venv first

| Shell | Activate |
|-------|----------|
| Git Bash | `source .venv/Scripts/activate` |
| PowerShell | `.\.venv\Scripts\Activate.ps1` |
| CMD | `.venv\Scripts\activate.bat` |
| macOS / Linux | `source .venv/bin/activate` |

If PowerShell blocks scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Then, with the venv active:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

> **Git Bash note:** `Activate.ps1` is for PowerShell only. Prefer `source .venv/Scripts/activate` or the `python.exe -m uvicorn …` command above.

---

## 3. Check that it works

| Resource | URL |
|----------|-----|
| Health | http://127.0.0.1:8000/health |
| Interactive docs | http://127.0.0.1:8000/docs |
| Presets | http://127.0.0.1:8000/api/presets |

Useful API paths (see `/docs` for query params):

| Path | Role |
|------|------|
| `GET /health` | Liveness |
| `GET /api/presets` | Challenge / survey targets |
| `GET /api/observations` | SPHEREx metadata near RA/Dec |
| `GET /api/observations/frames` | Epoch frames for blink |
| `GET /api/cutouts/png` | On-demand PNG cutout |

`GET /` returns **404** on purpose — there is no HTML homepage. Use `/health` or `/docs`.

---

## 4. Run tests

**Windows (Git Bash):**

```bash
cd backend
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
./.venv/Scripts/python.exe -m pytest -q
```

**macOS / Linux:**

```bash
cd backend
./.venv/bin/python -m pip install -r requirements-dev.txt
./.venv/bin/python -m pytest -q
```

---

## 5. Frontend pairing

| App | Folder | Start |
|-----|--------|--------|
| API | `backend/` | `uvicorn` on port **8000** (this README) |
| UI | `frontend/` | `npm run dev` on port **5173** |

Keep both running. CORS must include the Vite origin (`CORS_ORIGINS` in `.env`).

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| `Activate.ps1` fails in Git Bash | Expected. Use `./.venv/Scripts/python.exe -m uvicorn …` or `source .venv/Scripts/activate`. |
| Port 8000 already in use | Stop the other process, or change `--port`. |
| `GET /` → 404 | Normal. Open `/health` or `/docs`. |
| Frontend cannot call API | Confirm uvicorn is up; check `CORS_ORIGINS` matches `http://127.0.0.1:5173`. |
| IRSA / SSL errors on Windows | `truststore` is used at startup; reinstall deps if missing. |
| Missing packages | Re-run `pip install -r requirements.txt` with the **venv** Python. |

Stop the server with `Ctrl+C`.
