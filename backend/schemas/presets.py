from typing import Literal

from pydantic import BaseModel, Field

PresetCategory = Literal["official_test", "survey_field"]


class PresetLocation(BaseModel):
    """Predefined sky position the frontend can jump to.

    ``ra``/``dec`` are the coordinates to point at. Without ``?epoch`` they are
    the catalog position (usually J2000). With ``?epoch`` they are propagated
    with proper motion so a fast star is still inside a small SPHEREx cutout.
    """

    id: str
    name: str
    ra: float = Field(ge=0.0, lt=360.0, description="Right ascension to point at (deg, ICRS)")
    dec: float = Field(ge=-90.0, le=90.0, description="Declination to point at (deg, ICRS)")
    radius_deg: float = Field(
        gt=0.0,
        le=180.0,
        description="Suggested search radius (deg)",
    )
    description: str
    category: PresetCategory
    object_type: str = Field(description="e.g. red_dwarf, brown_dwarf, variable_star, survey_region")
    pm_ra: float | None = Field(
        default=None,
        description="Proper motion μ_α cos δ (mas/yr). None if unknown.",
    )
    pm_dec: float | None = Field(default=None, description="Proper motion μ_δ (mas/yr)")
    epoch: float = Field(default=2000.0, description="Epoch of ra/dec (decimal year)")
    fov_deg: float = Field(gt=0.0, le=40.0, description="Recommended Aladin field of view (deg)")
    highlight: str = Field(description="What the user should look for")
    catalog_ra: float | None = Field(default=None, description="Unpropagated catalog RA, if ra was moved")
    catalog_dec: float | None = Field(default=None, description="Unpropagated catalog Dec, if dec was moved")
    catalog_epoch: float | None = Field(default=None, description="Epoch of catalog_ra/catalog_dec")
