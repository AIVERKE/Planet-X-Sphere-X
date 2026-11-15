from fastapi import APIRouter

from schemas.presets import PresetLocation

router = APIRouter(prefix="/presets", tags=["presets"])

# Built as PresetLocation instances so a typo in the coordinates fails at import time.
PRESET_LOCATIONS: tuple[PresetLocation, ...] = (
    PresetLocation(
        id="nep",
        name="Polo Eclíptico Norte (NEP)",
        ra=270.0,
        dec=66.56,
        radius_deg=10.0,
        description="Zona de alta profundidad y solapamiento de observaciones de SPHEREx.",
    ),
    PresetLocation(
        id="sep",
        name="Polo Eclíptico Sur (SEP)",
        ra=90.0,
        dec=-66.56,
        radius_deg=10.0,
        description="Región austral de calibración y sondeo continuo.",
    ),
    PresetLocation(
        id="galactic_center",
        name="Cercanías del Centro Galáctico",
        ra=266.416,
        dec=-29.007,
        radius_deg=5.0,
        description="Región densa en estrellas y viveros estelares.",
    ),
)


@router.get("", response_model=list[PresetLocation])
def get_preset_locations() -> list[PresetLocation]:
    return list(PRESET_LOCATIONS)
