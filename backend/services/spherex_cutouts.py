"""SPHEREx Level-2 cutouts: download a FITS MEF from IRSA and render a PNG.

Spectral-image products (and the cutouts IRSA derives from them) are
multi-extension FITS files, not a single image:

- HDU 0 ``PRIMARY`` — header only, no pixels.
- HDU ``IMAGE`` — calibrated surface brightness in MJy/sr (about 6.2 arcsec
  per pixel on the full frame). This is the only array the preview uses.
  Its primary WCS is celestial (TAN + SIP distortion). Zodiacal light is
  still in the image; it is not subtracted.
- HDU ``FLAGS`` — per-pixel status bitmap. Not used for the preview.
- HDU ``VARIANCE`` — variance in (MJy/sr)^2. Not used for the preview.
- HDU ``ZODI`` — zodiacal model, not subtracted from ``IMAGE``.
- HDU ``EPSF`` (or ``PSF``) — effective PSF table. Not an image.
- HDU ``WCS-WAVE`` — lookup table of wavelength and bandwidth. The alternate
  WCS with key ``W`` on ``IMAGE`` points at this table. It is spectral, not
  spatial, and must not be used to align frames.

Cutouts keep those extension names. ``IMAGE``, ``FLAGS``, ``VARIANCE`` and
``ZODI`` are cropped; the PSF table is copied whole.

Extraction rule: use the 2D HDU named ``IMAGE`` (or ``SCI`` / ``FLUX``).
If that name is missing, use the first 2D image HDU that has a celestial
WCS. The WCS is ``WCS(header).celestial`` with the default (primary) key,
never key ``W``.

Every PNG is reprojected onto the same north-up TAN grid centered on the
requested RA/Dec, then stretched with one shared zscale interval so a
static source does not jump in position or brightness between epochs of
the same detector.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import tempfile
import threading
import time
import warnings
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin, urlsplit

import numpy as np
import requests
from astropy.io import fits
from astropy.visualization import AsinhStretch, ZScaleInterval
from astropy.wcs import WCS
from PIL import Image
from reproject import reproject_interp

from services import irsa_sia

logger = logging.getLogger(__name__)

IRSA_HOST = "irsa.ipac.caltech.edu"
OUTPUT_PIXELS = 192
MAX_FRAMES = 16
SCIENCE_EXTNAMES = frozenset({"IMAGE", "SCI", "FLUX"})
_MAX_ATTEMPTS = 5
_RETRY_DELAY_SEC = 2.0
_LOCK = threading.Lock()


class InvalidCutoutUrl(Exception):
    """The cutout URL is not an https resource on IRSA."""


class UnknownBand(Exception):
    """``band`` is not a SPHEREx detector id."""


class CutoutDataError(Exception):
    """The file was reached but has no usable science image."""


def cache_dir() -> Path:
    """Directory for downloaded FITS and rendered PNG files."""
    return Path(__file__).resolve().parents[1] / ".cache" / "cutouts"


def validate_irsa_url(url: str) -> str:
    """Accept only https URLs whose host is exactly IRSA. No userinfo."""
    if not isinstance(url, str) or not url.strip():
        raise InvalidCutoutUrl("url must be an https://irsa.ipac.caltech.edu cutout")
    parsed = urlsplit(url.strip())
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or host != IRSA_HOST or parsed.username or parsed.password:
        raise InvalidCutoutUrl("url must be an https://irsa.ipac.caltech.edu cutout")
    return url.strip()


def detector_code(value: Any) -> str | None:
    """Map ``D3`` / ``SPHEREx-D3`` to ``D3``. Anything else is None."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    if len(text) >= 2 and text[-2:].upper() in {f"D{i}" for i in range(1, 7)}:
        prefix = text[:-2]
        if prefix == "" or prefix.upper() == "SPHEREX-":
            return text[-2:].upper()
    return None


def select_band(
    records: list[dict[str, Any]],
    band: str | None,
) -> tuple[str | None, list[str], list[dict[str, Any]]]:
    """Pick one detector and the records that belong to it, in input order.

    ``band`` may be ``D1``…``D6`` or ``SPHEREx-D1``…``D6``. When it is
    omitted, the detector with the most cutouts wins; ties break toward
    the earlier detector (D1 before D2).
    """
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        code = detector_code(record.get("energy_bandpassname"))
        cutout_url = record.get("cutout_url")
        if code and isinstance(cutout_url, str) and cutout_url:
            groups[code].append(record)
    available = sorted(groups)
    if band is not None and str(band).strip():
        code = detector_code(str(band))
        if code is None:
            raise UnknownBand("band must be D1-D6 or SPHEREx-D1 through SPHEREx-D6")
        return code, available, list(groups.get(code, []))
    if not groups:
        return None, [], []
    chosen = min(groups, key=lambda name: (-len(groups[name]), name))
    return chosen, available, list(groups[chosen])


def sample_evenly(records: list[dict[str, Any]], limit: int = MAX_FRAMES) -> list[dict[str, Any]]:
    """Keep ``limit`` rows spread across the list, preserving order."""
    count = len(records)
    if count <= limit or limit <= 0:
        return list(records)
    raw = [int(round(float(pos))) for pos in np.linspace(0, count - 1, limit)]
    chosen: list[int] = []
    used: set[int] = set()
    for index in raw:
        index = min(max(index, 0), count - 1)
        if index not in used:
            used.add(index)
            chosen.append(index)
    if len(chosen) < limit:
        for index in range(count):
            if index not in used:
                used.add(index)
                chosen.append(index)
            if len(chosen) == limit:
                break
    chosen.sort()
    return [records[index] for index in chosen]


def build_png_url(
    cutout_url: str,
    ra: float,
    dec: float,
    size_deg: float,
    vmin: float,
    vmax: float,
) -> str:
    """Relative URL the browser can request through the Vite proxy."""
    query = urlencode(
        {
            "url": cutout_url,
            "ra": f"{ra:.8g}",
            "dec": f"{dec:.8g}",
            "size": f"{size_deg:.8g}",
            "vmin": f"{vmin:.8g}",
            "vmax": f"{vmax:.8g}",
        }
    )
    return f"/api/cutouts/png?{query}"


def _fits_cache_path(url: str) -> Path:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return cache_dir() / "fits" / f"{digest}.fits"


def _png_cache_path(
    url: str,
    ra: float,
    dec: float,
    size_deg: float,
    vmin: float,
    vmax: float,
) -> Path:
    raw = "|".join(
        [
            url,
            f"{ra:.8g}",
            f"{dec:.8g}",
            f"{size_deg:.8g}",
            f"{vmin:.8g}",
            f"{vmax:.8g}",
            str(OUTPUT_PIXELS),
        ]
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return cache_dir() / "png" / f"{digest}.png"


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _download_once(url: str) -> bytes:
    """GET a FITS body, following only same-host redirects."""
    current = url
    for _hop in range(4):
        response = requests.get(current, timeout=(5, 60), allow_redirects=False)
        try:
            code = response.status_code
            if code in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location:
                    raise irsa_sia.UpstreamServiceError("IRSA redirect missing Location")
                nxt = urljoin(current, location)
                try:
                    validate_irsa_url(nxt)
                except InvalidCutoutUrl as exc:
                    raise InvalidCutoutUrl("IRSA redirect left the allowed host") from exc
                current = nxt
                continue
            if code != 200:
                raise irsa_sia.UpstreamServiceError(f"IRSA cutout HTTP {code}")
            data = response.content
        finally:
            try:
                response.close()
            except Exception:
                pass
        if len(data) < 80 or not data.startswith(b"SIMPLE"):
            raise CutoutDataError("IRSA response is not a FITS file")
        return data
    raise irsa_sia.UpstreamServiceError("IRSA cutout redirected too many times")


def download_fits(url: str) -> Path:
    """Return a cached FITS path, downloading from IRSA on a miss."""
    url = validate_irsa_url(url)
    path = _fits_cache_path(url)
    if path.is_file() and path.stat().st_size >= 80:
        logger.info("FITS cache hit %s", path.name)
        return path
    logger.info("FITS cache miss; downloading %s", url)
    last_exc: Exception | None = None
    data: bytes | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            data = _download_once(url)
            break
        except (InvalidCutoutUrl, CutoutDataError):
            raise
        except (requests.RequestException, OSError, irsa_sia.UpstreamServiceError) as exc:
            last_exc = exc
            if attempt < _MAX_ATTEMPTS:
                time.sleep(_RETRY_DELAY_SEC * attempt)
                continue
            detail = str(exc).strip() or exc.__class__.__name__
            raise irsa_sia.UpstreamServiceError(f"IRSA cutout download failed: {detail}") from exc
    if data is None:
        raise irsa_sia.UpstreamServiceError(f"IRSA cutout download failed: {last_exc}")
    with _LOCK:
        if not (path.is_file() and path.stat().st_size >= 80):
            _atomic_write(path, data)
    return path


def _is_image_2d(hdu: fits.HDUBase) -> bool:
    data = hdu.data
    return isinstance(data, np.ndarray) and data.ndim == 2 and data.size > 0


def _celestial_wcs(header: fits.Header) -> WCS | None:
    try:
        wcs = WCS(header).celestial
    except (ValueError, IndexError, fits.VerifyError):
        return None
    if not wcs.has_celestial or wcs.naxis != 2:
        return None
    return wcs


def read_science(path: Path) -> tuple[np.ndarray, WCS]:
    """Load the science image and its celestial WCS. Ignores FLAGS/VARIANCE/ZODI."""
    with fits.open(path, memmap=False) as hdul:
        named: fits.HDUBase | None = None
        for hdu in hdul:
            if _is_image_2d(hdu) and str(hdu.name).upper() in SCIENCE_EXTNAMES:
                named = hdu
                break
        chosen = named
        if chosen is None:
            for hdu in hdul:
                if _is_image_2d(hdu) and _celestial_wcs(hdu.header) is not None:
                    chosen = hdu
                    break
        if chosen is None:
            raise CutoutDataError("FITS has no science image extension")
        wcs = _celestial_wcs(chosen.header)
        if wcs is None:
            raise CutoutDataError("science image has no celestial WCS")
        data = np.array(chosen.data, dtype=np.float64, copy=True)
    return data, wcs


def output_wcs(ra: float, dec: float, size_deg: float, n_pixels: int = OUTPUT_PIXELS) -> WCS:
    """North-up TAN centered on ``(ra, dec)`` covering ``size_deg`` on a side."""
    wcs = WCS(naxis=2)
    scale = size_deg / n_pixels
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.cunit = ["deg", "deg"]
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.crpix = [(n_pixels + 1) / 2.0, (n_pixels + 1) / 2.0]
    wcs.wcs.cdelt = [-scale, scale]
    wcs.wcs.equinox = 2000.0
    return wcs


def reproject_science(
    data: np.ndarray,
    wcs: WCS,
    ra: float,
    dec: float,
    size_deg: float,
) -> np.ndarray:
    """Resample onto the shared output grid. Off-footprint pixels become NaN."""
    target = output_wcs(ra, dec, size_deg)
    projected, _footprint = reproject_interp(
        (np.asarray(data, dtype=np.float64), wcs),
        target,
        shape_out=(OUTPUT_PIXELS, OUTPUT_PIXELS),
    )
    projected = np.asarray(projected, dtype=np.float64)
    return np.where(np.isfinite(projected), projected, np.nan)


def _load_projected(url: str, ra: float, dec: float, size_deg: float) -> np.ndarray:
    path = download_fits(url)
    data, wcs = read_science(path)
    return reproject_science(data, wcs, ra, dec, size_deg)


def stretch_limits(frames: list[np.ndarray]) -> tuple[float, float]:
    """Zscale limits of the median frame, so every epoch shares one scale."""
    if not frames:
        raise CutoutDataError("no frames to scale")
    stack = np.stack([np.asarray(frame, dtype=np.float64) for frame in frames], axis=0)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        median = np.nanmedian(stack, axis=0)
    finite = median[np.isfinite(median)]
    if finite.size == 0:
        raise CutoutDataError("frame has no finite pixels")
    vmin, vmax = ZScaleInterval().get_limits(finite)
    vmin_f = float(vmin)
    vmax_f = float(vmax)
    if not np.isfinite(vmin_f) or not np.isfinite(vmax_f) or vmax_f <= vmin_f:
        vmin_f = float(np.min(finite))
        vmax_f = float(np.max(finite))
        if vmax_f <= vmin_f:
            vmax_f = vmin_f + 1.0
    return vmin_f, vmax_f


def shared_stretch(
    urls: list[str],
    ra: float,
    dec: float,
    size_deg: float,
) -> tuple[float, float]:
    """Download and reproject every cutout, then return one zscale interval."""
    arrays = [_load_projected(url, ra, dec, size_deg) for url in urls]
    return stretch_limits(arrays)


def stretch_to_uint8(data: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    """Asinh stretch into 0–255. Non-finite pixels become 0 (black)."""
    if not np.isfinite(vmin) or not np.isfinite(vmax) or vmax <= vmin:
        finite = data[np.isfinite(data)]
        if finite.size == 0:
            return np.zeros(np.shape(data), dtype=np.uint8)
        vmin = float(np.min(finite))
        vmax = float(np.max(finite))
        if vmax <= vmin:
            vmax = vmin + 1.0
    filled = np.where(np.isfinite(data), data, vmin)
    scaled = np.clip((filled - vmin) / (vmax - vmin), 0.0, 1.0)
    # AsinhStretch maps the unit interval; ImageNormalize needs matplotlib, which we don't ship.
    stretched = np.asarray(AsinhStretch()(scaled), dtype=np.float64)
    stretched = np.nan_to_num(stretched, nan=0.0, posinf=1.0, neginf=0.0)
    return np.clip(np.rint(stretched * 255.0), 0, 255).astype(np.uint8)


def _png_bytes(pixels: np.ndarray) -> bytes:
    image = Image.fromarray(pixels, mode="L")
    return _encode_png(image)


def _encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def render_png(
    url: str,
    ra: float,
    dec: float,
    size_deg: float,
    vmin: float | None = None,
    vmax: float | None = None,
) -> bytes:
    """Render one cutout. ``vmin``/``vmax`` fix the stretch; omit them to zscale this frame."""
    url = validate_irsa_url(url)
    array: np.ndarray | None = None
    if vmin is None or vmax is None:
        array = _load_projected(url, ra, dec, size_deg)
        auto_vmin, auto_vmax = stretch_limits([array])
        if vmin is None:
            vmin = auto_vmin
        if vmax is None:
            vmax = auto_vmax
    path = _png_cache_path(url, ra, dec, size_deg, vmin, vmax)
    if path.is_file() and path.stat().st_size > 8:
        logger.info("PNG cache hit %s", path.name)
        return path.read_bytes()
    logger.info("PNG cache miss %s", path.name)
    if array is None:
        array = _load_projected(url, ra, dec, size_deg)
    payload = _png_bytes(stretch_to_uint8(array, vmin, vmax))
    with _LOCK:
        if not (path.is_file() and path.stat().st_size > 8):
            _atomic_write(path, payload)
    return payload
