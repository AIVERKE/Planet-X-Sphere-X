"""Épocas WISE time-resolved vía API WiseView (Backyard Worlds / unWISE).

Los coadds NEO del Legacy Survey son *acumulativos* (cada uno incluye años
anteriores), así que el blink casi no muestra movimiento propio.

WiseView sirve cortes time-resolved reales (ventana temporal estrecha), los
mismos que http://byw.tools/wiseview — ahí sí se ve el salto entre épocas.
"""

from __future__ import annotations

import io
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import numpy as np
import requests
from PIL import Image

from services import irsa_sia

logger = logging.getLogger(__name__)

PNG_ANIM = "https://vjxontvb73.execute-api.us-west-2.amazonaws.com/png-animation"
S3_BASE = "https://amnh-citsci-public.s3-us-west-2.amazonaws.com/"
MAX_FRAMES = 10

# WiseView escala lineal entre minbright y maxbright. 500 sirve para campos
# normales, pero en nebulosas brillantes (Orión) todo pasa de 500: el PNG llega
# 85–100 % blanco y, con las pocas zonas oscuras, parece un negativo.
MAX_BRIGHT_DEFAULT = 500.0
# Rangos más anchos que se prueban en paralelo solo si el de 500 sale quemado.
MAX_BRIGHT_LADDER = (5_000.0, 25_000.0, 150_000.0, 1_000_000.0)
# "Quemado": demasiados píxeles blancos o un cielo mediano ya claro.
BURNT_WHITE_SHARE = 0.20
BURNT_MEDIAN = 200.0
# "Legible": casi nada saturado y un cielo que todavía se ve oscuro.
READABLE_WHITE_SHARE = 0.05
READABLE_MEDIAN = 170.0
# Rango elegido por posición, para no repetir la búsqueda en cada apertura.
_RANGE_CACHE_MAX = 256
_range_cache: dict[tuple[float, float, int, int], float] = {}


class WiseViewError(RuntimeError):
    """Fallo al hablar con WiseView."""


def _mjd_to_year_label(mjd: float) -> str:
    # MJD → año decimal aproximado (suficiente para etiqueta de blink).
    try:
        # 51544.5 = J2000.0
        year = 2000.0 + (float(mjd) - 51544.5) / 365.25
        return f"~{year:.1f}"
    except (TypeError, ValueError):
        return "—"


def _flatten_num(value: object) -> float | None:
    if isinstance(value, (list, tuple)) and value:
        return _flatten_num(value[0])
    try:
        n = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return n if n == n else None


def _sample_evenly(items: list, max_n: int) -> list:
    if len(items) <= max_n:
        return items
    if max_n <= 1:
        return [items[0]]
    last = len(items) - 1
    seen: set[int] = set()
    out = []
    for i in range(max_n):
        idx = int(round(i * last / (max_n - 1)))
        if idx in seen:
            continue
        seen.add(idx)
        out.append(items[idx])
    return out if len(out) >= 2 else items[:max_n]


def _request_pairs(
    ra: float,
    dec: float,
    *,
    size_px: int,
    band: int,
    window: float,
    maxbright: float,
    read_timeout: float = 55.0,
) -> list[tuple[str, float | None]]:
    """Una llamada a WiseView png-animation → [(clave S3, MJD), …] por época."""
    params = {
        "ra": f"{ra:.8f}",
        "dec": f"{dec:.8f}",
        "band": int(band),
        "size": size_px,
        "max_dyr": 0,
        "minbright": -50.0,
        "maxbright": float(maxbright),
        # invert=0 → cielo oscuro (encaja con la UI); invert=1 salía casi blanco en el modal.
        "invert": 0,
        "stretch": 1,
        "diff": 0,
        "scandir": 0,
        "outer": 0,
        "neowise": 0,
        # 0 = time-resolved (slider a la izquierda en WiseView).
        "window": float(window),
        "diff_window": 1,
        "unique": 1,
        "smooth_scan": 0,
        "shift": 0,
        "pmx": 0,
        "pmy": 0,
        "synth_a": 0,
        "synth_a_sub": 0,
        "synth_a_ra": "",
        "synth_a_dec": "",
        "synth_a_w1": "",
        "synth_a_w2": "",
        "synth_a_pmra": 0,
        "synth_a_pmdec": 0,
        "synth_a_mjd": "",
        "synth_b": 0,
        "synth_b_sub": 0,
        "synth_b_ra": "",
        "synth_b_dec": "",
        "synth_b_w1": "",
        "synth_b_w2": "",
        "synth_b_pmra": 0,
        "synth_b_pmdec": 0,
        "synth_b_mjd": "",
    }
    try:
        response = requests.get(PNG_ANIM, params=params, timeout=(8, read_timeout))
    except requests.RequestException as exc:
        raise irsa_sia.UpstreamServiceError(f"WiseView no respondió: {exc}") from exc

    try:
        if response.status_code != 200:
            raise irsa_sia.UpstreamServiceError(f"WiseView HTTP {response.status_code}")
        payload = response.json()
    except ValueError as exc:
        raise irsa_sia.UpstreamServiceError("WiseView devolvió JSON inválido") from exc
    finally:
        try:
            response.close()
        except Exception:
            pass

    if isinstance(payload, dict) and payload.get("message") == "Service Unavailable":
        raise irsa_sia.UpstreamServiceError("WiseView Service Unavailable")

    ims = payload.get("ims") or []
    mjds = payload.get("mjds") or []
    if not isinstance(ims, list) or len(ims) < 2:
        raise WiseViewError("WiseView no devolvió suficientes épocas time-resolved")

    pairs: list[tuple[str, float | None]] = []
    for i, key in enumerate(ims):
        if not isinstance(key, str) or not key.startswith("cutouts/"):
            continue
        mjd = _flatten_num(mjds[i]) if i < len(mjds) else None
        pairs.append((key, mjd))

    if len(pairs) < 2:
        raise WiseViewError("WiseView: rutas de imagen inválidas")
    return pairs


def _brightness(s3_key: str) -> tuple[float, float]:
    """(fracción de píxeles blancos, mediana 0–255) de un PNG WiseView."""
    data = fetch_png_bytes(s3_key)
    gray = np.asarray(Image.open(io.BytesIO(data)).convert("L"), dtype=np.uint8)
    return float((gray >= 250).mean()), float(np.median(gray))


def _probe_key(pairs: list[tuple[str, float | None]]) -> str:
    # Época central: las primeras suelen ser las más brillantes.
    return pairs[len(pairs) // 2][0]


def _is_burnt(white: float, median: float) -> bool:
    return white > BURNT_WHITE_SHARE or median >= BURNT_MEDIAN


def _is_readable(white: float, median: float) -> bool:
    return white <= READABLE_WHITE_SHARE and median <= READABLE_MEDIAN


def _pairs_with_readable_range(
    ra: float, dec: float, *, size_px: int, band: int, window: float
) -> tuple[list[tuple[str, float | None]], float]:
    """Pide el rango normal; si la foto llega quemada, busca uno más ancho."""
    pairs = _request_pairs(
        ra, dec, size_px=size_px, band=band, window=window, maxbright=MAX_BRIGHT_DEFAULT
    )
    try:
        white, median = _brightness(_probe_key(pairs))
    except (irsa_sia.UpstreamServiceError, WiseViewError, OSError) as exc:
        logger.info("WiseView: no se pudo medir el brillo (%s); rango normal", exc)
        return pairs, MAX_BRIGHT_DEFAULT
    if not _is_burnt(white, median):
        return pairs, MAX_BRIGHT_DEFAULT

    def attempt(level: float):
        try:
            level_pairs = _request_pairs(
                ra,
                dec,
                size_px=size_px,
                band=band,
                window=window,
                maxbright=level,
                read_timeout=30.0,
            )
            level_white, level_median = _brightness(_probe_key(level_pairs))
        except (irsa_sia.UpstreamServiceError, WiseViewError, OSError):
            return None
        return level, level_pairs, level_white, level_median

    with ThreadPoolExecutor(max_workers=len(MAX_BRIGHT_LADDER)) as pool:
        results = [r for r in pool.map(attempt, MAX_BRIGHT_LADDER) if r is not None]
    if not results:
        logger.info("WiseView: campo quemado y sin rango alternativo; se queda en %s", MAX_BRIGHT_DEFAULT)
        return pairs, MAX_BRIGHT_DEFAULT

    readable = [r for r in results if _is_readable(r[2], r[3])]
    # El rango más estrecho que ya se lee; si ninguno, el menos saturado.
    best = (
        min(readable, key=lambda r: r[0])
        if readable
        else min(results, key=lambda r: (r[2], r[3]))
    )
    logger.info(
        "WiseView: campo brillante (%.0f%% blanco a %s) → maxbright=%s (%.0f%% blanco)",
        100 * white,
        MAX_BRIGHT_DEFAULT,
        best[0],
        100 * best[2],
    )
    return best[1], best[0]


def fetch_animation_meta(
    ra: float,
    dec: float,
    *,
    size_px: int = 160,
    band: int = 3,
    window: float = 0.0,
) -> dict:
    """Llama a WiseView png-animation (time-resolved si window≈0).

    Ajusta el rango de brillo al campo para que no llegue la foto en blanco.
    """
    size_px = max(64, min(int(size_px), 256))
    cache_key = (round(ra, 3), round(dec, 3), size_px, int(band))
    known = _range_cache.get(cache_key)
    if known is not None:
        pairs = _request_pairs(
            ra, dec, size_px=size_px, band=band, window=window, maxbright=known
        )
    else:
        pairs, known = _pairs_with_readable_range(
            ra, dec, size_px=size_px, band=band, window=window
        )
        if len(_range_cache) >= _RANGE_CACHE_MAX:
            _range_cache.pop(next(iter(_range_cache)))
        _range_cache[cache_key] = known

    sampled = _sample_evenly(pairs, MAX_FRAMES)
    frames = []
    for i, (key, mjd) in enumerate(sampled):
        frames.append(
            {
                "id": f"wv-{i}",
                "s3_key": key,
                "mjd": mjd,
                "year_hint": _mjd_to_year_label(mjd) if mjd is not None else "—",
                "label": f"Época {i + 1}",
            }
        )
    return {
        "matched": len(pairs),
        "returned": len(frames),
        "ra": ra,
        "dec": dec,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "frames": frames,
    }


def fetch_png_bytes(s3_key: str) -> bytes:
    """Descarga un PNG WiseView del bucket público AMNH."""
    if not s3_key.startswith("cutouts/") or ".." in s3_key or s3_key.startswith("/"):
        raise WiseViewError("Clave S3 no permitida")
    url = S3_BASE + s3_key
    try:
        response = requests.get(url, timeout=(5, 40))
    except requests.RequestException as exc:
        raise irsa_sia.UpstreamServiceError(f"S3 WiseView no respondió: {exc}") from exc
    try:
        if response.status_code != 200:
            raise irsa_sia.UpstreamServiceError(f"S3 WiseView HTTP {response.status_code}")
        data = response.content
    finally:
        try:
            response.close()
        except Exception:
            pass
    if len(data) < 64 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise irsa_sia.UpstreamServiceError("Respuesta S3 no es PNG")
    return data
