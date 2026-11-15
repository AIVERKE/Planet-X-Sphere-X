from fastapi import APIRouter, HTTPException, Query, status

from schemas.catalog import CatalogQuery, CatalogResponse
from services import irsa_catalog
from services.irsa_sia import UpstreamServiceError

router = APIRouter(prefix="/catalog", tags=["catalog"])


# Sync handler on purpose: FastAPI runs it in a threadpool, so the blocking
# IRSA request does not stall the event loop.
@router.get("", response_model=CatalogResponse)
def get_catalog(
    ra: float = Query(..., ge=0.0, lt=360.0, description="Right ascension (deg, ICRS)"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Declination (deg, ICRS)"),
    radius: float = Query(30.0, gt=0.0, le=3600.0, description="Search radius (arcsec)"),
    catalog: str = Query(
        irsa_catalog.DEFAULT_CATALOG,
        description="Catalog key: gaia_dr3 or allwise",
    ),
    limit: int = Query(100, ge=1, le=500, description="Maximum sources to return"),
    mag_max: float | None = Query(
        None,
        description="Optional magnitude cut (G for Gaia, W1 for AllWISE); keep mag <= mag_max",
    ),
) -> CatalogResponse:
    if catalog not in irsa_catalog.CATALOG_SPECS:
        raise HTTPException(
            status_code=422,
            detail=f"catalog must be one of: {', '.join(sorted(irsa_catalog.CATALOG_SPECS))}",
        )

    try:
        table = irsa_catalog.query_sources(ra, dec, radius, catalog)
    except UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    sources = irsa_catalog.normalize_sources(table, catalog, limit=limit, mag_max=mag_max)
    if not sources:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No sources found in '{catalog}' within {radius} arcsec of ({ra}, {dec})",
        )

    query = CatalogQuery(
        ra=ra,
        dec=dec,
        radius=radius,
        catalog=catalog,  # type: ignore[arg-type]
        limit=limit,
        mag_max=mag_max,
    )
    return CatalogResponse(query=query, count=len(sources), sources=sources)
