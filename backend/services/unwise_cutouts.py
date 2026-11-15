"""Proxy de cutouts unWISE (Legacy Survey) — capas NEO oficiales.

El navegador falla a menudo al precargar 6 JPEGs directos de legacysurvey.org
(timeouts / rate limit). El backend los pide una vez y los sirve same-origin.
"""

from __future__ import annotations

import requests

from services import irsa_sia

LS_CUTOUT = "https://www.legacysurvey.org/viewer/cutout.jpg"

# Capas NEO públicas del viewer (W1/W2 coadds acumulativos).
ALLOWED_LAYERS = frozenset(
    {
        "unwise-neo2",
        "unwise-neo3",
        "unwise-neo4",
        "unwise-neo6",
        "unwise-neo7",
        "unwise-neo11",
    }
)


class InvalidUnwiseLayer(ValueError):
    """Capa no permitida."""


def fetch_jpeg(
    ra: float,
    dec: float,
    layer: str,
    *,
    size: int = 280,
    pixscale: float = 2.75,
) -> bytes:
    if layer not in ALLOWED_LAYERS:
        raise InvalidUnwiseLayer(f"Capa unWISE no permitida: {layer}")
    size = max(32, min(int(size), 512))
    pixscale = max(0.5, min(float(pixscale), 8.0))
    try:
        response = requests.get(
            LS_CUTOUT,
            params={
                "ra": f"{ra:.8f}",
                "dec": f"{dec:.8f}",
                "layer": layer,
                "pixscale": str(pixscale),
                "size": str(size),
            },
            timeout=(5, 45),
        )
    except requests.RequestException as exc:
        raise irsa_sia.UpstreamServiceError(f"Legacy Survey no respondió: {exc}") from exc

    try:
        if response.status_code != 200:
            raise irsa_sia.UpstreamServiceError(
                f"Legacy Survey HTTP {response.status_code} para {layer}"
            )
        data = response.content
    finally:
        try:
            response.close()
        except Exception:
            pass

    # JPEG SOI
    if len(data) < 64 or data[:2] != b"\xff\xd8":
        raise irsa_sia.UpstreamServiceError(f"Respuesta no JPEG para {layer}")
    return data
