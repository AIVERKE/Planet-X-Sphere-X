from typing import Literal

from pydantic import BaseModel, Field

CatalogKey = Literal["gaia_dr3", "allwise"]


class CatalogQuery(BaseModel):
    ra: float = Field(description="Right ascension (deg, ICRS)")
    dec: float = Field(description="Declination (deg, ICRS)")
    radius: float = Field(description="Search radius (arcsec)")
    catalog: CatalogKey
    limit: int = Field(description="Maximum number of sources returned")
    mag_max: float | None = Field(
        default=None,
        description="Keep sources with mag <= mag_max (G or W1); null = no cut",
    )


class CatalogSource(BaseModel):
    """Normalized source for frontend overlays (name + sky position)."""

    id: str
    name: str
    ra: float | None = None
    dec: float | None = None
    catalog: CatalogKey
    mag: float | None = None
    pmra: float | None = None
    pmdec: float | None = None


class CatalogResponse(BaseModel):
    query: CatalogQuery
    count: int
    sources: list[CatalogSource]
