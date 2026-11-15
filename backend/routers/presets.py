from fastapi import APIRouter, Query

from schemas.presets import PresetLocation
from services.preset_motion import propagate_position

router = APIRouter(prefix="/presets", tags=["presets"])

# Coordinates checked against SIMBAD ICRS (ep=J2000) unless noted.
# pm_ra is μ_α cos δ in mas/yr (SIMBAD / Gaia EDR3 2020yCat.1350....0G, or the paper cited).
#
# The five official_test objects are the ones the challenge uses to grade the tool:
#   motion  — Barnard's Star, Epsilon Indi B, WISE 0855
#   brightness — RW Aurigae, R Draconis
# Fast movers must be propagated to ~2025.5 (GET /api/presets?epoch=2025.5) or a
# small SPHEREx cutout centered on J2000 misses the star. Barnard's Star walks
# ~10.4″/yr, about 4.5′ between 2000 and 2026, mostly north.
PRESET_LOCATIONS: tuple[PresetLocation, ...] = (
    PresetLocation(
        id="barnard",
        name="Barnard's Star",
        # SIMBAD NAME Barnard's star, ICRS ep=J2000, Gaia EDR3 (2020yCat.1350....0G):
        # 17 57 48.49847 +04 41 36.11388 ; pm −801.551, +10362.394 mas/yr.
        ra=269.45207696,
        dec=4.69336497,
        radius_deg=0.12,
        fov_deg=0.4,
        epoch=2000.0,
        pm_ra=-801.551,
        pm_dec=10362.394,
        category="official_test",
        object_type="red_dwarf",
        description="Enana roja con el mayor movimiento propio conocido (~10.4″/año).",
        highlight="Observa cómo se desplaza hacia el norte entre épocas. El botón apunta a ~2025, no al año 2000.",
    ),
    PresetLocation(
        id="eps_indi_b",
        name="Epsilon Indi B",
        # SIMBAD * eps Ind B, ICRS ep=J2000, Gaia EDR3: 22 04 10.59518 −56 46 58.23910
        # pm +3981.977, −2466.832 mas/yr (~4.7″/año).
        ra=331.04414659,
        dec=-56.78284420,
        radius_deg=0.10,
        fov_deg=0.4,
        epoch=2000.0,
        pm_ra=3981.977,
        pm_dec=-2466.832,
        category="official_test",
        object_type="brown_dwarf",
        description="Par de enanas marrones (T) con movimiento propio alto (~4.7″/año).",
        highlight="Observa el corrimiento del par respecto al fondo entre épocas WISE.",
    ),
    PresetLocation(
        id="wise_0855",
        name="WISE 0855",
        # Enunciado del reto / descubrimiento Luhman 2014: 08h55m10.831s, −07°14′42.53″.
        # Esa posición es la de la época del descubrimiento (~2010.5), no un J2000 puro.
        # SIMBAD (Kirkpatrick 2021ApJS..253....7K) da el J2000 ya propagado
        # 08 55 16.538 −07 14 49.37 y pm −8123.7, +673.2 mas/yr (~8.1″/año).
        # Guardamos la coord del enunciado con epoch=2010.5 para no contar el movimiento dos veces.
        ra=133.79512917,
        dec=-7.24514722,
        radius_deg=0.10,
        fov_deg=0.4,
        epoch=2010.5,
        pm_ra=-8123.7,
        pm_dec=673.2,
        category="official_test",
        object_type="brown_dwarf",
        description="Enana marrón ultrafría, de las más cercanas, con movimiento rápido (~8.1″/año).",
        highlight="Es el caso WiseView: misma idea (blink por época), centrado donde estará en la época SPHEREx.",
    ),
    PresetLocation(
        id="rw_aur",
        name="RW Aurigae",
        # SIMBAD V* RW Aur, ICRS ep=J2000 (2007A&A...474..653V): 05 07 49.56625 +30 24 05.17743
        # pm +7.23, −20.33 mas/yr — casi no se mueve; lo que importa es la variabilidad.
        ra=76.95652603,
        dec=30.40143817,
        radius_deg=0.08,
        fov_deg=0.4,
        epoch=2000.0,
        pm_ra=7.23,
        pm_dec=-20.33,
        category="official_test",
        object_type="variable_star",
        description="Estrella T Tauri joven. Cambia de brillo, no de sitio.",
        highlight="Compara el brillo entre épocas. El desplazamiento es menor que 1″ en 25 años.",
    ),
    PresetLocation(
        id="r_dra",
        name="R Draconis",
        # SIMBAD V* R Dra, ICRS ep=J2000, Gaia EDR3: 16 32 40.22660 +66 45 17.92590
        # pm −20.643, +6.149 mas/yr.
        ra=248.16761083,
        dec=66.75497942,
        radius_deg=0.08,
        fov_deg=0.4,
        epoch=2000.0,
        pm_ra=-20.643,
        pm_dec=6.149,
        category="official_test",
        object_type="variable_star",
        description="Variable tipo Mira con cambios de brillo muy marcados.",
        highlight="Busca variación de brillo entre épocas, no un salto de posición.",
    ),
    PresetLocation(
        id="nep",
        name="Polo Eclíptico Norte (NEP)",
        ra=270.0,
        dec=66.56,
        radius_deg=10.0,
        fov_deg=20.0,
        epoch=2000.0,
        category="survey_field",
        object_type="survey_region",
        description="Zona de alta profundidad y solapamiento de observaciones de SPHEREx.",
        highlight="Campo de sondeo: mucha cobertura SPHEREx, no un objeto en movimiento.",
    ),
    PresetLocation(
        id="sep",
        name="Polo Eclíptico Sur (SEP)",
        ra=90.0,
        dec=-66.56,
        radius_deg=10.0,
        fov_deg=20.0,
        epoch=2000.0,
        category="survey_field",
        object_type="survey_region",
        description="Región austral de calibración y sondeo continuo.",
        highlight="Campo de sondeo austral, no un objetivo de movimiento propio.",
    ),
    PresetLocation(
        id="galactic_center",
        name="Cercanías del Centro Galáctico",
        ra=266.416,
        dec=-29.007,
        radius_deg=5.0,
        fov_deg=10.0,
        epoch=2000.0,
        category="survey_field",
        object_type="survey_region",
        description="Región densa en estrellas y viveros estelares.",
        highlight="Campo denso para ver el atlas, no uno de los 5 objetos del reto.",
    ),
)


@router.get("", response_model=list[PresetLocation])
def get_preset_locations(
    epoch: float | None = Query(
        None,
        ge=1900.0,
        le=2100.0,
        description="If set, move objects with proper motion to this decimal year (e.g. 2025.5).",
    ),
    category: str | None = Query(
        None,
        pattern=r"^(official_test|survey_field)$",
        description="Filter: official_test (the 5 challenge stars) or survey_field.",
    ),
) -> list[PresetLocation]:
    items = PRESET_LOCATIONS
    if category is not None:
        items = tuple(p for p in items if p.category == category)
    if epoch is None:
        return list(items)
    return [propagate_position(p, epoch) for p in items]
