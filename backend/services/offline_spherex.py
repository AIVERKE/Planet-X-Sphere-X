"""Respaldo local cuando IRSA SIA no responde (demo Barnard's Star)."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

# Barnard's Star (época ~2025.5) — radio amplio para el preset.
BARNARD_RA = 269.44638
BARNARD_DEC = 4.76677
BARNARD_RADIUS_DEG = 0.2

_FRAMES_PATH = Path(__file__).resolve().parents[1] / "frames_barnard.json"


def near_barnard(ra: float, dec: float) -> bool:
    dra = (ra - BARNARD_RA) * math.cos(math.radians(BARNARD_DEC))
    ddec = dec - BARNARD_DEC
    return math.hypot(dra, ddec) <= BARNARD_RADIUS_DEG


@lru_cache(maxsize=1)
def _barnard_payload() -> dict[str, Any]:
    return json.loads(_FRAMES_PATH.read_text(encoding="utf-8"))


def _access_url_from_png(png_url: str) -> str | None:
    """Recupera el FITS IRSA embebido en /api/cutouts/png?url=…"""
    try:
        query = parse_qs(urlparse(png_url).query)
        raw = query.get("url", [None])[0]
        return unquote(raw) if raw else None
    except Exception:
        return None


def barnard_frames_response(
    ra: float,
    dec: float,
    radius: float,
    t_start: float,
    t_end: float,
    collection: str,
    cutout_size: float,
    band: str | None,
) -> dict[str, Any] | None:
    if not near_barnard(ra, dec) or not _FRAMES_PATH.is_file():
        return None
    data = _barnard_payload()
    chosen = (band or data.get("band") or "D1").upper().replace("SPHEREX-", "")
    frames = [f for f in data.get("frames", []) if str(f.get("band", "")).upper() == chosen]
    if not frames:
        frames = list(data.get("frames", []))
        chosen = str(data.get("band") or "D1")
    return {
        "query": {
            "ra": ra,
            "dec": dec,
            "radius": radius,
            "t_start": t_start,
            "t_end": t_end,
            "collection": collection,
            "cutout_size": cutout_size,
            "band": chosen,
        },
        "band": chosen,
        "available_bands": list(data.get("available_bands") or ["D1", "D2", "D3", "D4", "D5", "D6"]),
        "matched": int(data.get("matched") or len(frames)),
        "returned": len(frames),
        "vmin": data.get("vmin"),
        "vmax": data.get("vmax"),
        "frames": frames,
        "offline": True,
    }


def barnard_observations(
    ra: float,
    dec: float,
    radius: float,
    t_start: float,
    t_end: float,
    collection: str,
    cutout_size: float,
) -> tuple[dict[str, Any], list[dict[str, Any]]] | None:
    payload = barnard_frames_response(
        ra, dec, radius, t_start, t_end, collection, cutout_size, None
    )
    if payload is None:
        return None
    records: list[dict[str, Any]] = []
    for frame in payload["frames"]:
        access = _access_url_from_png(str(frame.get("png_url") or ""))
        records.append(
            {
                "obs_id": frame.get("obs_id"),
                "t_min": frame.get("t_min"),
                "t_max": frame.get("t_max"),
                "energy_bandpassname": f"SPHEREx-{frame.get('band') or 'D1'}",
                "access_url": access,
                "cutout_url": access,
                "s_ra": BARNARD_RA,
                "s_dec": BARNARD_DEC,
                "offline": True,
            }
        )
    query = {
        "ra": ra,
        "dec": dec,
        "radius": radius,
        "t_start": t_start,
        "t_end": t_end,
        "collection": collection,
        "cutout_size": cutout_size,
    }
    return query, records
