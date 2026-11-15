"""IRSA catalog cone searches (Gaia DR3 / AllWISE) for source overlays.

Returns normalized source rows (id, name, ra, dec, mag, proper motion) suitable
for frontend labels. SPHEREx has no public source catalog on IRSA TAP; use
``/api/observations`` for image metadata instead.
"""
from typing import Any

import numpy as np
import pandas as pd
import requests
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.table import Table
from astroquery.ipac.irsa import Irsa
from pyvo.dal import DALAccessError

from services.irsa_sia import UpstreamServiceError, table_to_dataframe

DEFAULT_CATALOG = "gaia_dr3"

# Public API key -> IRSA TAP table name + columns to request.
CATALOG_SPECS: dict[str, dict[str, Any]] = {
    "gaia_dr3": {
        "table": "gaia_dr3_source",
        "columns": "designation,source_id,ra,dec,phot_g_mean_mag,pmra,pmdec",
        "mag_column": "phot_g_mean_mag",
        "id_column": "source_id",
        "has_pm": True,
    },
    "allwise": {
        "table": "allwise_p3as_psd",
        "columns": "designation,ra,dec,w1mpro,w2mpro,ph_qual",
        "mag_column": "w1mpro",
        "id_column": "designation",
        "has_pm": False,
    },
}


def resolve_catalog(catalog_key: str) -> dict[str, Any]:
    """Return catalog spec or raise ``KeyError`` for unknown keys."""
    try:
        return CATALOG_SPECS[catalog_key]
    except KeyError as exc:
        raise KeyError(f"Unknown catalog '{catalog_key}'") from exc


def query_sources(ra: float, dec: float, radius_arcsec: float, catalog_key: str) -> Table:
    """Cone-search an IRSA catalog and return an Astropy Table."""
    spec = resolve_catalog(catalog_key)
    coord = SkyCoord(ra=ra, dec=dec, unit="deg", frame="icrs")
    try:
        return Irsa.query_region(
            coord,
            catalog=spec["table"],
            spatial="Cone",
            radius=radius_arcsec * u.arcsec,
            columns=spec["columns"],
        )
    except (DALAccessError, requests.RequestException, OSError, ValueError) as exc:
        raise UpstreamServiceError(f"IRSA catalog query failed: {exc.__class__.__name__}") from exc


def _to_native(value: Any) -> Any:
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value


def _as_str_id(value: Any) -> str:
    native = _to_native(value)
    if native is None:
        return ""
    return str(native)


def normalize_sources(
    table: Table,
    catalog_key: str,
    *,
    limit: int,
    mag_max: float | None,
) -> list[dict[str, Any]]:
    """Map IRSA rows to overlay-friendly dicts, sorted by brightness."""
    spec = resolve_catalog(catalog_key)
    if table is None or len(table) == 0:
        return []

    df = table_to_dataframe(table)
    mag_col = spec["mag_column"]
    id_col = spec["id_column"]

    if mag_max is not None and mag_col in df.columns:
        df = df.loc[df[mag_col].isna() | (df[mag_col] <= mag_max)]

    if mag_col in df.columns:
        # Brighter first; NaN magnitudes last.
        df = df.assign(_mag_sort=df[mag_col].fillna(np.inf)).sort_values(
            "_mag_sort", kind="stable"
        )
        df = df.drop(columns=["_mag_sort"])
    else:
        df = df.reset_index(drop=True)

    df = df.head(limit).reset_index(drop=True)

    sources: list[dict[str, Any]] = []
    for row in df.to_dict(orient="records"):
        designation = _to_native(row.get("designation"))
        source_id = _as_str_id(row.get(id_col) if id_col in row else designation)
        name = designation if isinstance(designation, str) and designation else source_id
        mag = _to_native(row.get(mag_col)) if mag_col in row else None
        pmra = _to_native(row.get("pmra")) if spec["has_pm"] else None
        pmdec = _to_native(row.get("pmdec")) if spec["has_pm"] else None
        sources.append(
            {
                "id": source_id or name,
                "name": name,
                "ra": _to_native(row.get("ra")),
                "dec": _to_native(row.get("dec")),
                "catalog": catalog_key,
                "mag": mag,
                "pmra": pmra,
                "pmdec": pmdec,
            }
        )
    return sources
