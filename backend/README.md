# Backend — Planet-X Sphere-X

API FastAPI que consulta IRSA (SPHEREx), sirve presets y renderiza cutouts PNG.

## Requisitos

- Python **3.11+** (recomendado 3.13)
- (Opcional) PostgreSQL si usas endpoints que lean `DATABASE_URL`

## Setup (una vez)

Desde la carpeta `backend/`:

### Git Bash (MINGW64) — el que usas en Cursor

```bash
cd backend
py -3.13 -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -r requirements.txt
cp .env.example .env
```

### PowerShell

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edita `.env` si hace falta (`DATABASE_URL`, `CORS_ORIGINS`).

## Arrancar (sin activar el venv)

En **Git Bash**, `Activate.ps1` **no funciona**. Usa el Python del venv directo:

```bash
cd backend
./.venv/Scripts/python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### PowerShell

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Activar el venv (opcional)

| Shell        | Comando                              |
|--------------|--------------------------------------|
| Git Bash     | `source .venv/Scripts/activate`      |
| PowerShell   | `.\.venv\Scripts\Activate.ps1`       |
| CMD          | `.venv\Scripts\activate.bat`         |

Si PowerShell bloquea la activación:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Luego (con venv activo):

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## URLs

| Recurso | URL |
|---------|-----|
| Health  | http://127.0.0.1:8000/health |
| Docs    | http://127.0.0.1:8000/docs |
| Presets | http://127.0.0.1:8000/api/presets |

## Tests

```bash
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
./.venv/Scripts/python.exe -m pytest -q
```

## Nota

Esto **no** es un proyecto Node: no uses `npm run start:dev` aquí. El frontend va en `frontend/` con `npm run dev`.
