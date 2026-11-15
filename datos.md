I. INTRODUCCIÓN Y VISIÓN GENERAL
A. Descripción del Proyecto
Visor web público e interactivo que muestra imágenes del cielo de la misión SPHEREx de la NASA [1] y permite ver con rapidez cómo cambia una región del cielo con el tiempo. SPHEREx cartografía todo el cielo cada seis meses en 102 bandas del infrarrojo cercano (0,75–5,0 µm) y registra más de mil millones de objetos. Nuestro visor convierte ese volumen de datos en algo que cualquier persona puede explorar, sin conocimientos previos de astronomía ni de programación.
B. Propósito y Modelo de Interacción
El usuario introduce las coordenadas de una región del cielo (ascensión recta y declinación, en grados o en formato sexagesimal) o el nombre de un objeto, y elige el campo de visión. El visor reproduce las imágenes de todas las épocas disponibles como un pequeño video (blinking), de modo que los objetos que se mueven o cambian de brillo saltan a la vista. Las consultas también pueden hacerse desde la URL (por ejemplo, ?ra=133.795&dec=-7.245&fov=3), lo que permite compartir resultados e insertar el visor en otros sitios web.
C. Inspiración y Alcance
Nos inspiramos en WiseView [2] y en proyectos de ciencia ciudadana como Backyard Worlds [3], y en el método con el que se descubrió Plutón: comparar dos imágenes del mismo campo tomadas en fechas distintas. Validamos la herramienta con los cinco objetivos del reto [4]: la Estrella de Barnard (movimiento propio de unos 10″/año), Epsilon Indi B (par de enanas marrones que orbitan una estrella), WISE 0855 (enana marrón de movimiento rápido; AR 08h55m10.831s, Dec −07°14′42.53″) y las estrellas variables RW Aurigae y R Draconis. Con los tres primeros comprobamos la detección de movimiento y con los dos últimos, la de variaciones de brillo.
D. Contexto e Impacto Regional (Bolivia 2026)
Demostración de cómo utilizar código abierto (Python, FastAPI) y datos públicos globales para resolver retos de ingeniería y fomentar habilidades técnicas locales sin infraestructura costosa.
II. PLANTEAMIENTO DEL PROBLEMA
A. Problema General
SPHEREx genera más datos de los que una persona, o incluso un programa, puede analizar por completo: más de mil millones de objetos (enanas marrones, cuásares, cometas, asteroides, estrellas, supernovas y galaxias) que a menudo se solapan o varían de brillo. Hoy, consultar y ordenar estos datos en el tiempo requiere herramientas especializadas, lo que deja fuera al público general, justo el que podría ayudar a hacer nuevos descubrimientos.
B. Problemas Específicos
1) Latencia y peso de datos: Ineficiencia al intentar descargar archivos FITS completos, requiriendo un enfoque basado en metadatos y enlaces de acceso directo.
2) Falta de integración temporal: Ausencia de visores ligeros que organicen automáticamente las épocas de observación de forma cronológica.
3) Complejidad espectral: Cada imagen de SPHEREx cubre un rango de longitudes de onda distinto según la posición en el detector. Sin procesarlas, las 102 bandas son difíciles de interpretar y combinar.
4) Datos en constante crecimiento: Las publicaciones de datos se suceden con rapidez, así que una herramienta con colecciones fijas en el código se queda obsoleta enseguida.
5) Brecha de habilidades: Necesidad de acercar el desarrollo backend moderno y el consumo de APIs científicas a entornos con recursos limitados.
III. ARQUITECTURA Y DISEÑO TÉCNICO
A. Definición de Endpoints en FastAPI
Creación de la API web con FastAPI [5] para recibir parámetros de entrada (ra, dec, radio de búsqueda y rangos temporales t_start/t_end).
B. Gestión de Coordenadas con Astropy
Transformación y normalización de las coordenadas celestes con Astropy [6], utilizando SkyCoord con unidades en grados y segundos de arco (u.arcsec).
C. Consulta de Catálogos con Astroquery (IRSA)
Conexión automatizada, mediante Astroquery [7], al servicio SIA de IRSA (NASA) [8] para obtener la tabla de metadatos de las imágenes que cubren la posición consultada. La colección (por ejemplo, spherex_qr o spherex_dr1) es un parámetro de configuración y no está fija en el código, así que incorporar una nueva publicación de datos no requiere cambiar el código.
D. Filtrado y Serialización de Datos con Pandas
Procesamiento en memoria de las tablas obtenidas, filtrando registros por rangos de fechas (t_min, t_max) y transformándolos a formato JSON (orient="records") listo para el frontend.
E. Recortes bajo Demanda y Caché
En lugar de descargar archivos FITS completos, solicitamos al servicio de recortes de IRSA solo la región correspondiente al campo de visión elegido. Los recortes se guardan en caché para que las consultas repetidas, como las de los objetivos de prueba, respondan al instante. Un campo más amplio permite seguir objetos rápidos, a cambio de una transferencia algo mayor.
F. Aprovechamiento de las 102 Bandas
Agrupamos las imágenes de cada época por detector (seis matrices) y las sumamos para mejorar la relación señal/ruido. Ofrecemos una vista en falso color que asigna rangos de longitud de onda a canales RGB. A partir de la solución de longitud de onda de cada píxel, generamos al vuelo el espectro (0,75–5,0 µm) del punto en el que el usuario hace clic.
G. Detección de Movimiento y Variabilidad
Además del blinking, el usuario puede sumar imágenes de varias épocas, para ver objetos débiles, o restarlas, para obtener imágenes de diferencia en las que las fuentes fijas se cancelan y los objetos en movimiento aparecen como pares positivo/negativo.
H. Superposición de Catálogos Externos
Integración de Aladin Lite (CDS) [9] para mostrar fuentes de Gaia [10] y WISE [11] sobre las imágenes de SPHEREx, lo que ayuda a confirmar movimientos propios y a descartar falsos positivos.
I. Metadatos y Calidad
Cada fotograma muestra su fecha de observación, detector, rango de longitud de onda e indicadores de contaminación (flags) del archivo. Así, el usuario distingue un objeto real de un artefacto instrumental.
IV. VIABILIDAD, MERCADO E IMPACTO SOCIAL
A. Modelo de Adopción y Gamificación
Enfoque de ciencia ciudadana basado en la detección visual de cambios (efecto detective). Proyectos como Backyard Worlds [3] han demostrado que voluntarios con herramientas sencillas descubren cometas y enanas marrones; de hecho, la mayoría de los conocidos se hallaron así. El visor incluye un modo guiado con los objetivos de prueba como tutorial y enlaces compartibles para reportar candidatos.
B. Propuesta de Valor Regional
Alfabetización digital y transferencia de competencias en desarrollo de software. La solución usa solo datos públicos y software libre (Python, FastAPI, Astropy, Astroquery, Aladin Lite), funciona desde un navegador y puede desplegarse con un costo de infraestructura mínimo. Eso permite replicarla en colegios, universidades y clubes de astronomía de Bolivia y de la región. La interfaz estará en español e inglés.
V. CONCLUSIONES Y PRÓXIMOS PASOS
A. Estado Actual
Implementación exitosa del motor backend en FastAPI y validación de consultas SIA con IRSA.
B. Hoja de Ruta (Roadmap)
(1) Frontend con reproductor de secuencia, selector de campo de visión y parámetros en la URL; (2) recortes con caché y suma por detector; (3) imágenes de diferencia y espectros al vuelo; (4) superposición de Gaia y WISE con Aladin Lite y visualización de flags de calidad.
C. Criterios de Éxito para la Demostración
Que los cinco objetivos del reto se carguen desde una URL y que el movimiento de la Estrella de Barnard, Epsilon Indi B y WISE 0855, así como la variabilidad de RW Aurigae y R Draconis, sean visibles para un usuario sin formación astronómica en menos de un minuto.
