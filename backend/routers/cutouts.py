from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from services import irsa_sia, spherex_cutouts

router = APIRouter(prefix="/cutouts", tags=["cutouts"])


# Sync handler on purpose: FastAPI runs it in a threadpool, so the blocking
# FITS download and reprojection do not stall the event loop.
@router.get("/png")
def get_cutout_png(
    url: str = Query(..., description="IRSA cutout URL (https://irsa.ipac.caltech.edu/...)"),
    ra: float = Query(..., ge=0.0, lt=360.0, description="Right ascension (deg, ICRS)"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Declination (deg, ICRS)"),
    size: float = Query(0.05, gt=0.0, le=1.0, description="Cutout size (deg)"),
    vmin: float | None = Query(None, description="Shared stretch minimum"),
    vmax: float | None = Query(None, description="Shared stretch maximum"),
) -> Response:
    try:
        payload = spherex_cutouts.render_png(url, ra, dec, size, vmin, vmax)
    except spherex_cutouts.InvalidCutoutUrl as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except irsa_sia.UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except spherex_cutouts.CutoutDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(content=payload, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
