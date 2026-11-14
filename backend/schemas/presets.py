from pydantic import BaseModel, Field


class PresetLocation(BaseModel):
    """Predefined sky region the frontend can jump to."""

    id: str
    name: str
    ra: float = Field(ge=0.0, lt=360.0, description="Right ascension (deg, ICRS)")
    dec: float = Field(ge=-90.0, le=90.0, description="Declination (deg, ICRS)")
    radius_deg: float = Field(
        gt=0.0,
        le=180.0,
        description="Suggested view radius (deg); e.g. Aladin FOV = 2 * radius_deg",
    )
    description: str
