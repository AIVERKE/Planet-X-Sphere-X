"""Épocas WISE time-resolved vía API WiseView (Backyard Worlds / unWISE).

Los coadds NEO del Legacy Survey son *acumulativos* (cada uno incluye años
anteriores), así que el blink casi no muestra movimiento propio.

WiseView sirve cortes time-resolved reales (ventana temporal estrecha), los
mismos que http://byw.tools/wiseview — ahí sí se ve el salto entre épocas.
"""

from __future__ import annotations

from datetime import datetime, timezone

import requests

from services import irsa_sia

PNG_ANIM = "https://vjxontvb73.execute-api.us-west-2.amazonaws.com/png-animation"
S3_BASE = "https://amnh-citsci-public.s3-us-west-2.amazonaws.com/"
MAX_FRAMES = 10


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


def fetch_animation_meta(
    ra: float,
    dec: float,
    *,
    size_px: int = 160,
    band: int = 3,
    window: float = 0.0,
) -> dict:
    """Llama a WiseView png-animation (time-resolved si window≈0)."""
    size_px = max(64, min(int(size_px), 256))
    params = {
        "ra": f"{ra:.8f}",
        "dec": f"{dec:.8f}",
        "band": int(band),
        "size": size_px,
        "max_dyr": 0,
        "minbright": -50.0,
        "maxbright": 500.0,
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
        response = requests.get(PNG_ANIM, params=params, timeout=(8, 55))
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
