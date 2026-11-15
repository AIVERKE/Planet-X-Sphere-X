from fastapi import APIRouter, HTTPException, Query, status

from schemas.observations import (
    FrameRecord,
    FramesQuery,
    FramesResponse,
    GroupedObservationsResponse,
    ObservationQuery,
    ObservationsResponse,
)
from services import irsa_sia, spherex_cutouts

router = APIRouter(prefix="/observations", tags=["observations"])


def _load_records(
    ra: float,
    dec: float,
    radius: float,
    t_start: float,
    t_end: float,
    collection: str,
    cutout_size: float,
) -> tuple[ObservationQuery, list[dict]]:
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
    return query, records


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
    query, records = _load_records(ra, dec, radius, t_start, t_end, collection, cutout_size)
    if group_by_band:
        return GroupedObservationsResponse(
            query=query, count=len(records), bands=irsa_sia.group_by_band(records)
        )
    return ObservationsResponse(query=query, count=len(records), observations=records)


@router.get("/frames", response_model=FramesResponse)
def get_frames(
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
    band: str | None = Query(None, description="Detector D1-D6 or SPHEREx-D1; default is the fullest band"),
) -> FramesResponse:
    """Epochs of one detector, ordered by t_min, each pointing at a PNG."""
    query, records = _load_records(ra, dec, radius, t_start, t_end, collection, cutout_size)
    try:
        chosen, available, selected = spherex_cutouts.select_band(records, band)
    except spherex_cutouts.UnknownBand as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if chosen is None or not selected:
        label = f"SPHEREx-{chosen}" if chosen else (band or "D1-D6")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No images in band '{label}' within {radius} arcsec of ({ra}, {dec})",
        )

    matched = len(selected)
    sampled = spherex_cutouts.sample_evenly(selected, spherex_cutouts.MAX_FRAMES)
    urls = [str(record["cutout_url"]) for record in sampled]
    try:
        vmin, vmax = spherex_cutouts.shared_stretch(urls, ra, dec, cutout_size)
    except spherex_cutouts.InvalidCutoutUrl as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except irsa_sia.UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except spherex_cutouts.CutoutDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    frames = [
        FrameRecord(
            obs_id=str(record.get("obs_id") or ""),
            t_min=float(record["t_min"]),
            t_max=None if record.get("t_max") is None else float(record["t_max"]),
            band=chosen,
            png_url=spherex_cutouts.build_png_url(
                str(record["cutout_url"]), ra, dec, cutout_size, vmin, vmax
            ),
        )
        for record in sampled
    ]
    return FramesResponse(
        query=FramesQuery(**query.model_dump(), band=chosen),
        band=chosen,
        available_bands=available,
        matched=matched,
        returned=len(frames),
        vmin=vmin,
        vmax=vmax,
        frames=frames,
    )
