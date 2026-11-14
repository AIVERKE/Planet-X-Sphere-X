# Planet-X Sphere-X

Monorepo con:

- **backend/** — API en Python con **FastAPI** + **PostgreSQL** (SQLAlchemy 2.x, sync, driver `psycopg2`).
- **frontend/** — aplicación **Vue 3** con **Vite** (JavaScript, npm).

## Requisitos

| Herramienta | Versión |
|-------------|---------|
| Python      | 3.11+   |
| Node.js     | 20.19+ LTS (o 22.12+) |
| npm         | 10+     |
| PostgreSQL  | 14+ (local o remoto) |
| Git         | cualquiera reciente |

> Todos los comandos están pensados para **Windows PowerShell**, ejecutados desde la raíz del repositorio.

## Estructura

```
Planet-X-Sphere-X/
├── backend/
│   ├── main.py            # App FastAPI, CORS, /health y registro de routers
│   ├── database.py        # Engine + SessionLocal (SQLAlchemy 2.x) desde DATABASE_URL
│   ├── routers/           # Endpoints (montados bajo el prefijo /api)
│   ├── models/            # Modelos ORM (heredan de database.Base)
│   ├── schemas/           # Esquemas Pydantic
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── .env.example
└── README.md
```

## Backend

### 1. Base de datos PostgreSQL

Necesitas un servidor PostgreSQL accesible. Crea la base de datos (ejemplo con `psql`):

```powershell
psql -U postgres -c "CREATE DATABASE planet_x;"
```

En este punto **no** se crean tablas ni hay migraciones. La conexión es perezosa: la API arranca aunque PostgreSQL no esté disponible; solo fallará cuando un endpoint use la base de datos.

### 2. Entorno y dependencias

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> Si PowerShell bloquea la activación del entorno, ejecuta una vez:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

### 3. Variables de entorno

```powershell
Copy-Item .env.example .env
```

Edita `backend/.env` con tus credenciales:

```env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/planet_x
CORS_ORIGINS=http://localhost:5173
```

### 4. Arrancar

```powershell
uvicorn main:app --reload
```

- Salud: <http://localhost:8000/health> → `{"status":"ok"}`
- Swagger UI: <http://localhost:8000/docs>
- Endpoint de ejemplo: <http://localhost:8000/api/example>

## Frontend

En otra terminal, desde la raíz del repositorio:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Abre <http://localhost:5173>. La página llama a `GET {VITE_API_URL}/health` y muestra el estado del backend (sirve también para comprobar que CORS funciona).

Variables (`frontend/.env`):

```env
VITE_API_URL=http://localhost:8000
```

## Convenciones

- Código en inglés; documentación en español.
- Los routers de negocio se montan bajo el prefijo `/api`.
- `.env` nunca se versiona; solo `.env.example`.
- Mensajes de commit siguiendo [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`…).
