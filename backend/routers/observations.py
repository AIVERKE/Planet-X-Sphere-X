from fastapi import APIRouter, HTTPException, Query, status

from schemas.observations import (
    GroupedObservationsResponse,
    ObservationQuery,
    ObservationsResponse,
)
from services import irsa_sia

router = APIRouter(prefix="/observations", tags=["observations"])


# Sync handler on purpose: FastAPI runs it in a threadpool, so the blocking
# IRSA request does not stall the event loop.
@router.get("", response_model=ObservationsResponse | GroupedObservationsResponse)
def get_observations(
    ra: float = Query(..., ge=0.0, lt=360.0, description="Right ascension (deg, ICRS)"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Declination (deg, ICRS)"),
    radius: float = Query(1.0, gt=0.0, le=3600.0, description="Search radius (arcsec)"),
    t_start: float = Query(0.0, description="Lower bound for t_min (MJD)"),
    t_end: float = Query(99999.0, description="Upper bound for t_max (MJD)"),
    collection: str = Query(
        irsa_sia.DEFAULT_COLLECTION,
        pattern=r"^[a-z0-9_]+$",
        max_length=64,
        description="IRSA SIA collection, e.g. spherex_dr1, spherex_dr1_deep",
    ),
    cutout_size: float = Query(0.05, gt=0.0, le=1.0, description="Cutout size (deg)"),
    group_by_band: bool = Query(False, description="Group records by energy_bandpassname"),
) -> ObservationsResponse | GroupedObservationsResponse:
    if t_start > t_end:
        raise HTTPException(
            status_code=422,  # literal: the Starlette constant name changed across versions
            detail="t_start must be less than or equal to t_end",
        )

    try:
        table = irsa_sia.query_images(ra, dec, radius, collection)
    except irsa_sia.UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if table is None or len(table) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No images found in '{collection}' within {radius} arcsec of ({ra}, {dec})",
        )

    df = irsa_sia.filter_by_time(irsa_sia.table_to_dataframe(table), t_start, t_end)
    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{len(table)} image(s) found, but none within MJD [{t_start}, {t_end}]",
        )

    df = irsa_sia.add_cutout_urls(df, ra, dec, cutout_size)
    records = irsa_sia.to_records(df)
    query = ObservationQuery(
        ra=ra,
        dec=dec,
        radius=radius,
        t_start=t_start,
        t_end=t_end,
        collection=collection,
        cutout_size=cutout_size,
    )

    if group_by_band:
        return GroupedObservationsResponse(
            query=query, count=len(records), bands=irsa_sia.group_by_band(records)
        )
    return ObservationsResponse(query=query, count=len(records), observations=records)
