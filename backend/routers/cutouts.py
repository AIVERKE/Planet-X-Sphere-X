from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services import irsa_sia, spherex_cutouts, unwise_cutouts, wiseview_frames

router = APIRouter(prefix="/cutouts", tags=["cutouts"])


class WiseViewFrameOut(BaseModel):
    id: str
    label: str
    year_hint: str
    mjd: float | None = None
    png_url: str = Field(description="PNG same-origin (proxy S3 WiseView)")


class WiseViewFramesOut(BaseModel):
    matched: int
    returned: int
    ra: float
    dec: float
    frames: list[WiseViewFrameOut]


@router.get("/wiseview", response_model=WiseViewFramesOut)
def list_wiseview_frames(
    ra: float = Query(..., ge=0.0, lt=360.0),
    dec: float = Query(..., ge=-90.0, le=90.0),
    size: int = Query(160, ge=64, le=256, description="Lado en píxeles unWISE"),
) -> WiseViewFramesOut:
    """Épocas WISE time-resolved (WiseView). Muestran movimiento propio real."""
    try:
        meta = wiseview_frames.fetch_animation_meta(ra, dec, size_px=size)
    except wiseview_frames.WiseViewError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except irsa_sia.UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    frames = [
        WiseViewFrameOut(
            id=f["id"],
            label=f["label"],
            year_hint=f["year_hint"],
            mjd=f["mjd"],
            png_url=f"/api/cutouts/wiseview-png?key={quote(f['s3_key'], safe='')}",
        )
        for f in meta["frames"]
    ]
    return WiseViewFramesOut(
        matched=meta["matched"],
        returned=meta["returned"],
        ra=meta["ra"],
        dec=meta["dec"],
        frames=frames,
    )


@router.get("/wiseview-png")
def get_wiseview_png(
    key: str = Query(..., description="Clave S3 cutouts/… de WiseView"),
) -> Response:
    try:
        payload = wiseview_frames.fetch_png_bytes(key)
    except wiseview_frames.WiseViewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except irsa_sia.UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return Response(
        content=payload,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/unwise")
def get_unwise_cutout(
    ra: float = Query(..., ge=0.0, lt=360.0, description="Right ascension (deg, ICRS)"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Declination (deg, ICRS)"),
    layer: str = Query(..., description="Capa NEO: unwise-neo2 … unwise-neo11"),
    size: int = Query(280, ge=32, le=512, description="Lado del JPEG en píxeles"),
    pixscale: float = Query(2.75, gt=0.5, le=8.0, description="″/píxel (nativo unWISE ≈ 2.75)"),
) -> Response:
    """JPEG oficial unWISE (Legacy Survey), same-origin para el blink multi-época."""
    try:
        payload = unwise_cutouts.fetch_jpeg(ra, dec, layer, size=size, pixscale=pixscale)
    except unwise_cutouts.InvalidUnwiseLayer as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except irsa_sia.UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return Response(
        content=payload,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


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
    style: str = Query("raw", pattern=r"^(raw|hd)$", description="raw = scientific; hd = filled + upscaled grayscale"),
) -> Response:
    try:
        payload = spherex_cutouts.render_png(url, ra, dec, size, vmin, vmax, style=style)
    except spherex_cutouts.InvalidCutoutUrl as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except irsa_sia.UpstreamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except spherex_cutouts.CutoutDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(content=payload, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
