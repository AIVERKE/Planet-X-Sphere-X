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
- Observaciones SPHEREx: <http://localhost:8000/api/observations?ra=270&dec=66.56&radius=10>

### 5. Endpoint de observaciones (`GET /api/observations`)

Consulta el servicio SIA v2 de IRSA (`Irsa.query_sia`) y devuelve los metadatos ObsCore de las imágenes que cubren una posición, filtrados por época. **No descarga FITS**: cada registro incluye `access_url` (imagen completa) y `cutout_url` (recorte en el servidor de IRSA centrado en la posición pedida).

| Parámetro       | Tipo  | Por defecto   | Descripción |
|-----------------|-------|---------------|-------------|
| `ra`            | float | — (obligatorio) | Ascensión recta, grados ICRS (`0 ≤ ra < 360`) |
| `dec`           | float | — (obligatorio) | Declinación, grados ICRS (`-90 ≤ dec ≤ 90`) |
| `radius`        | float | `1.0`         | Radio de búsqueda en **segundos de arco** (`0 < radius ≤ 3600`) |
| `t_start`       | float | `0.0`         | Límite inferior de `t_min`, en **MJD** |
| `t_end`         | float | `99999.0`     | Límite superior de `t_max`, en **MJD** |
| `collection`    | str   | `spherex_dr1` | Colección SIA de IRSA (p. ej. `spherex_dr1_deep`, `spherex_qr3`) |
| `cutout_size`   | float | `0.05`        | Lado del recorte en grados (`0 < size ≤ 1`) |
| `group_by_band` | bool  | `false`       | Agrupar por `energy_bandpassname` (`SPHEREx-D1` … `SPHEREx-D6`) |

Una imagen se incluye solo si su exposición completa cae dentro de la ventana (`t_min ≥ t_start` y `t_max ≤ t_end`). Los resultados se ordenan por `t_min`.

Respuesta (`group_by_band=false`):

```json
{
  "query": {"ra": 270.0, "dec": 66.56, "radius": 10.0, "t_start": 0.0, "t_end": 99999.0, "collection": "spherex_dr1", "cutout_size": 0.05},
  "count": 439,
  "observations": [
    {"obs_id": "2025W17_4B_0091_1", "energy_bandpassname": "SPHEREx-D5", "t_min": 60790.35, "t_max": 60790.35, "access_url": "https://irsa.ipac.caltech.edu/…fits", "cutout_url": "https://irsa.ipac.caltech.edu/…fits?center=270.0,66.56&size=0.05", "...": "resto de columnas ObsCore"}
  ]
}
```

Con `group_by_band=true` se devuelve `bands: {"SPHEREx-D1": [...], ...}` en lugar de `observations`. Los valores ausentes (NaN/enmascarados) llegan como `null`.

Códigos de error: `404` si no hay imágenes en la posición o ninguna en la ventana temporal; `422` si los parámetros no son válidos (incluido `t_start > t_end`); `503` si IRSA no responde o falla.

`GET /api/observations` sigue sin descargar píxeles. El reproductor usa los dos endpoints siguientes.

### 6. Fotogramas y PNG (`GET /api/observations/frames`, `GET /api/cutouts/png`)

`/api/observations/frames` repite la consulta SIA y devuelve las épocas de **un solo detector**, ordenadas por `t_min`. Si no se pasa `band`, elige el detector con más épocas (empate: D1 antes que D2). Hay un tope de 16 épocas repartidas en el tiempo (`matched` es el total del detector, `returned` las que entran en la respuesta).

Cada fotograma trae `obs_id`, `t_min`, `t_max`, `band` (`D1`…`D6`) y `png_url`, una ruta relativa `/api/cutouts/png?...`. Esa ruta ya incluye `vmin` y `vmax`: el backend reproyecta los recortes a una grilla común (norte arriba, centrada en el RA/Dec pedido, 192×192) y calcula el zscale **una vez** sobre la mediana del conjunto.

`/api/cutouts/png` descarga el FITS desde IRSA, lee solo la extensión `IMAGE` (el WCS espectral `W` no se usa para alinear) y responde `image/png`. El navegador no recibe el FITS.

| Parámetro | En `frames` | En `png` | Notas |
|-----------|-------------|----------|--------|
| `ra`, `dec`, `radius`, `t_start`, `t_end`, `collection`, `cutout_size` | sí | `ra`, `dec`, `size` | Mismos límites que `/api/observations`. `size` es el lado en grados. |
| `band` | opcional | — | `D1`…`D6` o `SPHEREx-D1`…`D6` |
| `url` | — | obligatorio | Tiene que ser `https://irsa.ipac.caltech.edu/...`. Cualquier otro host, `http` o un redirect fuera de IRSA responde **400** y no se llama a la red. |
| `vmin`, `vmax` | en la respuesta | opcionales | Escala compartida. Si faltan, el PNG usa el zscale de ese cuadro solo. |

Los FITS descargados y los PNG quedan en `backend/.cache/cutouts/` (no se versiona). La segunda reproducción del mismo objetivo no vuelve a pedir el archivo a IRSA.

Errores: `400` URL fuera de IRSA; `404` sin imágenes o sin épocas en ese detector; `422` parámetros inválidos o FITS sin imagen científica; `503` si IRSA no responde.

### Tests

```powershell
pip install -r requirements-dev.txt
pytest -q
```

Los tests simulan `Irsa.query_sia` y las descargas de cutouts, por lo que no necesitan red.

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
