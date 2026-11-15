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


class FramesQuery(ObservationQuery):
    band: str = Field(description="Detector code, e.g. D1")


class FrameRecord(BaseModel):
    """One SPHEREx epoch, already ordered, with browser-ready PNG URLs."""

    obs_id: str
    t_min: float
    t_max: float | None = None
    band: str
    png_url: str = Field(description="Scientific preview (may show saturated cores as black).")
    png_url_hd: str = Field(
        description="Same epoch, filled + upscaled HD render for the side-by-side blink."
    )


class FramesResponse(BaseModel):
    """Epochs of a single detector. Brightness is scaled per frame so the list returns immediately."""

    query: FramesQuery
    band: str
    available_bands: list[str]
    matched: int
    returned: int
    vmin: float | None = None
    vmax: float | None = None
    frames: list[FrameRecord]
