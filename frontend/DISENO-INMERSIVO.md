# Instrucción de diseño inmersivo — Vue 3

Análisis de `frontend/propuesta.mp4` y especificación para construir el recorrido en el frontend existente.

El video no se copia. Se toma su lenguaje visual (cámara continua, niebla como transición, tipografía anclada al paisaje, marcadores en rombo, globo y paneles editoriales) y se convierte en un explorador de planetas solo frontend.

---

## 1. Qué muestra el video

Clip vertical de **20,93 s**, **576×1024**, **30 fps**. Es una grabación de una laptop recorriendo el sitio de Montfort con el trackpad. El overlay de TikTok y el teclado no forman parte del producto.

| Tiempo | Qué ocurre en pantalla | Qué debe sobrevivir en el producto |
| --- | --- | --- |
| 0,0–1,0 s | Hero oscuro. Cadena montañosa con luz rasante cálida en las cumbres y azul profundo en los valles. Nav superior fina: marca a la izquierda, secciones al centro, `NEWS` y `MENU` a la derecha. | Paisaje 3D a baja altura. Cromo de interfaz mínimo, tipografía pequeña y muy espaciada. |
| 1,0–5,0 s | El scroll sube la cámara. El cielo pasa a crema. La montaña queda al centro, medio tapada por niebla. La palabra `MONTFORT · TRADING` se parte a izquierda y derecha del pico. Líneas verticales finas bajan por el encuadre. | Niebla como volumen, no como corte. El texto vive en el mundo: se desplaza con parallax y se disuelve cuando la cámara lo atraviesa. |
| 5,0–7,5 s | Sobre la niebla aparece un bloque editorial: titular grande a la izquierda y párrafo corto a la derecha, ambos con tracking alto. | Capítulos de texto sincronizados con `scrollProgress`, nunca un scroll de HTML independiente de la cámara. |
| 7,5–10,5 s | La niebla se vuelve tormenta. Aparece un buque. Rombo con índice `3`, rótulo de capítulo y titular en dos líneas. Cursor circular blanco. | Marcador de capítulo: rombo + número + nombre. El cursor custom solo sobre el canvas. |
| 10,5–13,0 s | La cámara sale de las nubes y encuadra el globo, con nubes blancas sobre océano oscuro. Hay rótulos pequeños sobre la superficie y el cursor circular. El limbo del planeta se recorta contra un fondo casi negro. | Globo en rotación, marcadores proyectados de 3D a DOM, atmósfera con fresnel y zoom-out hacia el negro. |
| 13,0–17,5 s | El 3D cede a páginas editoriales sobre un bosque desenfocado: titular, dos o tres columnas, rombo de capítulo, y al final una tira de imágenes. | A partir de aquí el video ya no viaja al espacio. En este producto ese tramo se sustituye por el dashboard de planetas, con el mismo lenguaje: vidrio oscuro, titular editorial, columnas de métricas y tarjetas. |
| 18 s en adelante | Pantalla de cierre de TikTok. | Se ignora. |

Lectura de diseño: **un solo plano continuo**. El scroll no cambia de página; cambia la altura de la cámara. La niebla es el fundido. La UI flota encima y se enciende o se apaga según la fase.

---

## 2. Producto a construir

Experiencia a pantalla completa, sin backend. Estado en Pinia. Scroll normalizado `scrollProgress` de `0` a `1`.

Al llegar a `0.85` el HUD se transforma en buscador y explorador. Elegir un planeta mueve la cámara con GSAP hasta su órbita. Solo en esa fase se activan `OrbitControls`.

La ruta inmersiva **no usa** el `AppLayout` de Vuetify (barra y drawer institucionales). Vive en su propia vista a `100vh`, con canvas WebGL fijo y HTML encima. Tailwind se añade solo para ese HUD. Los tokens MOF (`designSystem.ts`) no se aplican dentro del viaje; el look del video es cinematográfico: negro, crema, azul atmósfera y blanco de interfaz.

---

## 3. Fases de scroll

`scrollProgress` lo publica `useScrollProgress` leyendo un spacer de scroll (altura ≈ `500vh`). GSAP ScrollTrigger hace scrub del valor. Three.js no lee el DOM en cada frame: lee el número del store.

| Fase | Rango | Cámara | Escena 3D | UI |
| --- | --- | --- | --- | --- |
| 1. Tierra | `0.00–0.25` | Baja, frente a la cordillera. Sube despacio. Luz de amanecer oscuro a día. | Terreno FBM. 3 o 4 planos de niebla con ruido y alpha. | Nav. Líneas guía verticales con parallax horizontal. Titular partido a los lados del pico, como en el segundo 2 del video. |
| 2. Recorrido | `0.25–0.55` | Atraviesa la capa de nubes y queda en órbita baja. El globo gira lento. | Caparazón de nubes denso (misma niebla, más opaca) y luego `EarthGlobe`. | Rombo de capítulo. Marcadores `01 Amazonas`, `02 Himalaya`, `03 Pacífico`, `04 Andes` proyectados con `vector.project(camera)`. |
| 3. Espacio | `0.55–0.85` | Zoom-out orbital rápido. La Tierra se aleja. | Fresnel azul en la atmósfera. `InstancedMesh` de estrellas. Nebulosas de planos grandes con alpha baja. | El nav se atenúa. Aparece un índice de fase (`03 / ASCENSO`). |
| 4. Explorador | `0.85–1.00` | La cámara queda en el campo de planetas. Al elegir un cuerpo, GSAP interpola `position` y `lookAt`. | Los 6 planetas ya están en escena, separados en el eje que mira la cámara. Saturno lleva anillos. | Dashboard: buscador, filtros, telemetría en vidrio, hotspots de superficie. `OrbitControls` solo aquí. |

Curvas: la fase 3 usa un ease fuerte (`power3.in`) para el alejamiento. El resto es lineal respecto al scroll, para que el dedo y la cámara coincidan como en el video.

---

## 4. Árbol de archivos

Todo bajo `frontend/src`. Three.js queda fuera de los `.vue` salvo el componente que posee el canvas.

```
src/
  views/
    ExplorerView.vue                 # página: spacer de scroll + canvas + HUD
  components/explorer/
    SpaceCanvas.vue                  # monta el renderer y el loop
    ScrollStage.vue                  # altura del scroll y ancla de ScrollTrigger
    HudNav.vue                       # nav fina del segundo 0
    GuideLines.vue                   # líneas verticales
    ChapterMarker.vue                # rombo + índice + nombre
    EditorialCopy.vue                # titulares de las fases 1 a 3
    WorldMarker.vue                  # un marcador DOM posicionado en px
    PlanetExplorerHUD.vue            # shell del dashboard (fase 4)
    PlanetSearch.vue                 # input instantáneo
    PlanetFilters.vue                # Todos / Rocosos / Gigantes / Habitables
    TelemetryCard.vue                # vidrio con métricas del planeta activo
    AtmosphereBars.vue               # barras de gases
    HotspotLabel.vue                 # hotspot proyectado del planeta activo
  composables/
    useScrollProgress.ts             # ScrollTrigger → store
    useCameraRig.ts                  # aplica la pose de la fase o el viaje GSAP
    useProjectedMarkers.ts           # project() cada frame → estilo left/top
    usePlanetSearch.ts               # computed de búsqueda y filtros
  stores/
    useSpaceStore.ts                 # estado reactivo del viaje
  three/
    EarthToSpaceRig.ts               # construye escena, cámara, luces y poses
    createRenderer.ts                # renderer, tamaño, pixel ratio
    materials/
      fresnelAtmosphere.ts           # halo, uniform uAtmosphereColor
      fbmSurface.ts                  # superficie procedural
      fogPlanes.ts                   # niebla volumétrica falsa
      starfield.ts                   # puntos del instanced mesh
    scene/
      TerrainMountains.ts
      CloudShell.ts
      EarthGlobe.ts
      Starfield.ts
      PlanetBody.ts
      SaturnRings.ts
  data/
    planets.ts
    chapters.ts                      # textos de las fases 1–3
    worldMarkers.ts                  # Amazonas, Himalaya, Pacífico, Andes
  types/
    explorer.ts
```

La ruta se registra **fuera** de `AppLayout`:

```ts
{
  path: '/explorar',
  name: 'explorer',
  component: () => import('@/views/ExplorerView.vue'),
  meta: { title: 'Explorar' },
}
```

Dependencias a añadir en `frontend`: `three`, `gsap`, `@types/three`, `tailwindcss` y el plugin de Vite de Tailwind. No hace falta TresJS: el canvas se posee en un solo componente y el resto del grafo vive en módulos TypeScript marcados con `markRaw`.

---

## 5. Reglas Vue 3

1. Todos los componentes usan `<script setup lang="ts">`.
2. `Scene`, `PerspectiveCamera`, `WebGLRenderer`, `Mesh`, `ShaderMaterial`, `InstancedMesh`, `Points` y el `OrbitControls` se guardan en `shallowRef` o se crean con `markRaw`. Vue no debe hacer proxy profundo de esos objetos.
3. El loop es un `requestAnimationFrame` dentro de `SpaceCanvas.vue`. Se cancela en `onUnmounted`, junto con ScrollTrigger y el `ResizeObserver`.
4. El store de Pinia guarda números, ids y flags (`scrollProgress`, `phase`, `activePlanetId`, `query`, `filter`, `cameraMode`). No guarda objetos de Three.
5. Los shaders van en template strings dentro de `src/three/materials/`. No hay texturas remotas. El detalle sale de FBM.
6. Los marcadores DOM no viven dentro del canvas. Cada frame, `useProjectedMarkers` proyecta los `Vector3` y escribe `x`, `y`, `visible` en un array plano que las etiquetas leen.
7. `OrbitControls.enabled` es `true` solo cuando `phase === 4` y no hay un tween de viaje en curso.

---

## 6. Store

`useSpaceStore.ts`:

```ts
scrollProgress: number          // 0..1
phase: 1 | 2 | 3 | 4            // derivado del rango
activePlanetId: string          // default 'earth'
query: string
filter: 'todos' | 'rocosos' | 'gaseosos' | 'habitables'
cameraMode: 'scroll' | 'travel' | 'orbit'
hoveredMarkerId: string | null
```

`phase` es un `computed`. `cameraMode` pasa a `'travel'` al pulsar un planeta o «Viajar a superficie / órbita», y vuelve a `'orbit'` en el `onComplete` del tween. Durante `'travel'` y `'orbit'` el scroll deja de mover la cámara; un control «Volver al viaje» restaura `'scroll'` y hace scroll a `0.85`.

---

## 7. Rig de cámara

`EarthToSpaceRig.ts` exporta poses clave, no anima por su cuenta:

| Progreso | Posición aproximada (unidades de escena) | Mira |
| --- | --- | --- |
| 0.00 | `(0, 2.2, 18)` | cumbre `(0, 3.5, 0)` |
| 0.25 | `(0, 8, 10)` | pico entre la niebla |
| 0.55 | `(0, 14, 22)` | centro de la Tierra |
| 0.85 | `(0, 20, 48)` | Tierra pequeña y campo de planetas |
| viaje | posición de órbita del planeta elegido | centro de ese planeta |

`useCameraRig` interpola entre las poses con el progreso mientras `cameraMode === 'scroll'`. En `'travel'`, GSAP anima `camera.position` y un `Vector3` de `lookAt` en ~1.6 s (`power2.inOut`).

La luz direccional de la fase 1 empieza cálida y baja (`#c47a4a`) y a `0.25` ya es blanca y más alta. Eso reproduce el paso de cumbre iluminada a día crema del segundo 1 al 4.

---

## 8. Shaders

### Fresnel (`fresnelAtmosphere.ts`)

- Vertex: pasar normal de vista y posición de vista.
- Fragment: `intensity = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), uPower)`.
- Color: `uAtmosphereColor` (Tierra `#7ecbff`, Marte `#e07a4a`, Júpiter `#d7b48a`, Saturno `#e6d3a1`, Kepler-186f `#8fd0c3`, Trappist-1e `#9eb6ff`).
- Malla: esfera un 8 % mayor que el planeta, `Side = Back`, `transparent`, `depthWrite = false`.

### Superficie FBM (`fbmSurface.ts`)

- 5 octavas de ruido de valor en el fragment.
- Uniforms: `uColorA`, `uColorB`, `uColorC`, `uTime`, `uSeed`.
- El terreno de la fase 1 usa el mismo FBM desplazando vértices en el vertex shader (`displacement` alto). Los planetas lo usan solo como color, con relieve suave.
- Tierra: océano oscuro + continentes. Marte: óxido y casquetes. Júpiter: bandas por latitud mezcladas con FBM. Saturno: bandas pálidas. Exoplanetas: manchas sobrias, sin textura de foto.

### Niebla (`fogPlanes.ts`)

- 4 planos grandes cruzados delante de la cámara en la fase 1 y un cascarón alrededor de la Tierra en la fase 2.
- Fragment: FBM en UV animado con `uTime` * 0.02, alpha entre 0 y 0.55.
- Color: crema `#f3efe4` en la Tierra, gris tormenta `#8d97a3` al cruzar a `0.40`, y desvanecido a 0 al entrar en `0.55`.

### Estrellas

`InstancedMesh` de ~2 500 quads de un pixel, colores blanco y azul muy bajo. Sin parpadeo agresivo: alpha fijo por instancia.

---

## 9. Dataset

`src/data/planets.ts` exporta `Planet[]` con al menos:

| id | Nombre | Tipo | Notas de escena |
| --- | --- | --- | --- |
| earth | Tierra | rocoso | Ya visible desde la fase 2. Radio 1. |
| mars | Marte | rocoso | Radio ~0.53. Óxido. |
| jupiter | Júpiter | gaseoso | Radio ~2.4. Bandas. |
| saturn | Saturno | gaseoso | Radio ~2.0. Anillos en `SaturnRings.ts` (anillo con alpha por distancia al centro). |
| kepler-186f | Kepler-186f | habitable | Radio ~1.1. |
| trappist-1e | Trappist-1e | habitable | Radio ~0.92. |

Cada item incluye: `category`, `radius`, `distanceAu`, `gravity`, `temperatureC`, `habitability` (0–1), `atmosphere` (lista `{ gas, ratio }` que suma 1), `colors` para el shader, `orbitPosition: [x, y, z]`, y **dos hotspots** `{ id, label, position }` en coordenadas locales del planeta.

Marcadores de la fase 2 en `worldMarkers.ts`, con lat/lon reales aproximadas convertidas a `Vector3` sobre la esfera de la Tierra:

1. Amazonas
2. Himalaya
3. Pacífico
4. Andes

---

## 10. Componentes y su trabajo

### `ExplorerView.vue`

Contenedor `relative`. `SpaceCanvas` en `fixed inset-0`. `ScrollStage` empuja el scroll. Las capas HUD van en `fixed inset-0 pointer-events-none`, y solo los controles (nav, buscador, filtros, botones) reciben `pointer-events-auto`.

### `SpaceCanvas.vue`

Crea renderer, llama a `createEarthToSpaceRig()`, arranca el frame loop, observa el resize. No contiene plantillas de UI.

### `ScrollStage.vue`

Un `div` de altura `500vh`. ScrollTrigger con `scrub: 1` escribe `scrollProgress`.

### `HudNav.vue`

Réplica funcional del nav del segundo 0, con textos propios: marca `ORBITAL`, enlaces de fase (`TIERRA`, `MUNDO`, `ESPACIO`, `EXPLORAR`) que hacen `scrollTo` al inicio de cada rango, y un botón `MENÚ` que abre un panel con las mismas anclas. Fondo transparente. Texto 11 px, tracking `0.22em`, blanco al 80 %.

### `GuideLines.vue`

Cuatro líneas de 1 px, blancas al 18 %, de arriba a abajo. Su `translateX` es `scrollProgress * 40` con signos alternos. Visibles solo en fase 1 y al inicio de la 2.

### `ChapterMarker.vue`

Rombo hueco de 28 px (borde 1 px), número dentro o al lado, y el nombre del capítulo en tracking alto. Datos desde `chapters.ts`: `01 Cordillera`, `02 Mundo`, `03 Ascenso`, `04 Explorador`. Opacidad según distancia al centro de su rango.

### `EditorialCopy.vue`

Dos bloques, como en los segundos 6 y 9 del video:

- Titular a la izquierda, sans geométrica, peso 500, tamaño grande, tracking `0.18em`, mayúsculas.
- Párrafo corto a la derecha, 13 px, ancho máximo 280 px, blanco al 70 %.

Se enlazan a la fase y hacen fade con un margen de 0.04 de progreso antes y después.

### `WorldMarker.vue`

Punto circular de 28 px (el cursor del video es un aro; el marcador es un aro con número). Al hover muestra el nombre. `visible` pasa a falso si el punto queda detrás de la cámara (`ndc.z` fuera de rango) o si la fase no es 2.

### `PlanetExplorerHUD.vue`

Entra con opacidad y `translateY(16px)` cuando `scrollProgress >= 0.85`. Layout:

- Izquierda: `PlanetSearch` + `PlanetFilters` + lista de resultados.
- Derecha: `TelemetryCard`.
- Sobre el canvas: `HotspotLabel` de los dos hotspots del planeta activo.

El vidrio de la tarjeta es exactamente `backdrop-blur-md bg-slate-950/65 border border-white/10`.

### `PlanetSearch.vue` y `usePlanetSearch.ts`

`computed` que filtra por nombre, tipo y nombre de gas atmosférico, y luego por categoría:

- `Todos`
- `Rocosos` → Tierra, Marte
- `Gigantes Gaseosos` → Júpiter, Saturno
- `Exoplanetas Habitables` → Kepler-186f, Trappist-1e

La búsqueda es instantánea, sin botón.

### `TelemetryCard.vue`

Nombre, tipo, distancia, gravedad, temperatura, habitabilidad. Los números hacen un tween corto al cambiar de planeta (GSAP sobre un objeto plano, no sobre el mesh). `AtmosphereBars` dibuja una barra por gas. Botón `Viajar a superficie / órbita`: dispara el tween y, en un segundo estado, acerca la cámara a `radius * 2.2` para leer los hotspots. El botón alterna el rótulo entre órbita y superficie.

---

## 11. Interacción de la fase 4

1. El usuario escribe o pulsa un filtro. La lista se reduce.
2. Al elegir un planeta, `activePlanetId` cambia y `cameraMode` pasa a `'travel'`.
3. GSAP mueve la cámara a `orbitPosition + (0, radius * 0.6, radius * 4.5)` mirando al centro del planeta.
4. Al terminar, `cameraMode = 'orbit'` y `OrbitControls` gira alrededor de ese centro. `minDistance` y `maxDistance` se calculan con el radio para no atravesar la superficie.
5. Los hotspots se proyectan igual que los marcadores de la Tierra.
6. «Viajar a superficie» reduce la distancia. «Volver al viaje» desactiva controles, limpia el tween y devuelve el scroll a la fase 3–4.

---

## 12. Orden de construcción

1. Ruta `/explorar` a pantalla completa, canvas vacío y spacer de scroll con el progreso pintado en un número (comprobar que 0–1 recorre la página).
2. Terreno FBM + niebla + luz rasante. Sin UI.
3. Nav, líneas guía y titular partido, atados al progreso de la fase 1.
4. Globo, fresnel, marcadores proyectados, capítulo en rombo.
5. Zoom-out, estrellas, nebulosa.
6. Dataset, store y HUD de fase 4 con filtros `computed`.
7. Tween de viaje, `OrbitControls` condicional, hotspots y barras de atmósfera.
8. Ajuste de curvas para que el paso montaña → niebla → globo se sienta tan continuo como entre el segundo 1 y el 12 del video.

## 13. Comprobación visual

- A `0.00` se ve cordillera oscura con cumbres cálidas y nav legible.
- A `0.15` la montaña está centrada en niebla crema y el titular queda partido por el pico.
- A `0.40` la niebla ya es gris y los cuatro marcadores se leen sobre el globo.
- A `0.70` la Tierra es pequeña, el limbo es azul y el fondo es estrellado.
- A `0.90` el dashboard está visible, buscar `metano` o `kepler` filtra sin recargar, y elegir Saturno muestra los anillos y permite orbitar.
- Redimensionar la ventana no deja el renderer a tamaño viejo ni pierde el `ScrollTrigger`.
- Al salir de la ruta no queda un frame loop activo.
