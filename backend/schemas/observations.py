from typing import Any

from pydantic import BaseModel, Field


class ObservationQuery(BaseModel):
    ra: float = Field(description="Right ascension (deg, ICRS)")
    dec: float = Field(description="Declination (deg, ICRS)")
    radius: float = Field(description="Search radius (arcsec)")
    t_start: float = Field(description="Lower time bound (MJD)")
    t_end: float = Field(description="Upper time bound (MJD)")
    collection: str
    cutout_size: float = Field(description="Cutout size (deg)")


class ObservationsResponse(BaseModel):
    """Flat list of ObsCore records sorted by ``t_min``."""

    query: ObservationQuery
    count: int
    observations: list[dict[str, Any]]


class GroupedObservationsResponse(BaseModel):
    """ObsCore records grouped by ``energy_bandpassname``, each group sorted by ``t_min``."""

    query: ObservationQuery
    count: int
    bands: dict[str, list[dict[str, Any]]]
