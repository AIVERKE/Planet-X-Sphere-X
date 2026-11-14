"""IRSA Simple Image Access (SIA v2) queries and result post-processing.

Only image *metadata* is fetched (ObsCore rows with ``access_url``); FITS
pixels are never downloaded server-side. The client gets ``access_url`` plus
a ready-made ``cutout_url`` pointing to IRSA's on-the-fly cutout service.

ObsCore time columns ``t_min`` / ``t_max`` are Modified Julian Dates (MJD).
"""
from collections import defaultdict
from typing import Any

import numpy as np
import pandas as pd
import requests
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.table import Table
from astroquery.ipac.irsa import Irsa
from pyvo.dal import DALAccessError

DEFAULT_COLLECTION = "spherex_dr1"
BAND_COLUMN = "energy_bandpassname"
UNKNOWN_BAND = "unknown"


class UpstreamServiceError(Exception):
    """IRSA could not be reached or returned an unusable response."""


def query_images(ra: float, dec: float, radius_arcsec: float, collection: str) -> Table:
    """Run a SIA v2 cone search on IRSA and return the ObsCore table."""
    coord = SkyCoord(ra=ra, dec=dec, unit="deg", frame="icrs")
    try:
        return Irsa.query_sia(pos=(coord, radius_arcsec * u.arcsec), collection=collection)
    except (DALAccessError, requests.RequestException, OSError) as exc:
        # OSError covers socket errors, ConnectionError and TimeoutError.
        raise UpstreamServiceError(f"IRSA SIA query failed: {exc.__class__.__name__}") from exc


def table_to_dataframe(table: Table) -> pd.DataFrame:
    """Convert an astropy Table to pandas, dropping columns pandas can't hold."""
    multidim = [name for name in table.colnames if table[name].ndim > 1]
    if multidim:
        table = table.copy(copy_data=False)
        table.remove_columns(multidim)
    df = table.to_pandas()
    for name in df.columns:
        if df[name].dtype == object:
            df[name] = df[name].map(lambda v: v.decode("utf-8", "replace") if isinstance(v, bytes) else v)
    return df


def filter_by_time(df: pd.DataFrame, t_start: float, t_end: float) -> pd.DataFrame:
    """Keep observations whose whole exposure lies within [t_start, t_end] (MJD)."""
    mask = (df["t_min"] >= t_start) & (df["t_max"] <= t_end)
    return df.loc[mask].sort_values("t_min", kind="stable").reset_index(drop=True)


def add_cutout_urls(df: pd.DataFrame, ra: float, dec: float, size_deg: float) -> pd.DataFrame:
    """Add a ``cutout_url`` column using IRSA's ``center``/``size`` cutout parameters."""
    if "access_url" not in df.columns:
        return df

    def build(url: Any) -> str | None:
        if not isinstance(url, str) or not url:
            return None
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}center={ra},{dec}&size={size_deg}"

    df = df.copy()
    df["cutout_url"] = df["access_url"].map(build)
    return df


def _to_native(value: Any) -> Any:
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


def to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Serialize rows as JSON-safe dicts (NaN/inf/masked -> None, numpy -> Python)."""
    clean = df.astype(object).where(pd.notna(df), None)
    return [
        {key: _to_native(value) for key, value in row.items()}
        for row in clean.to_dict(orient="records")
    ]


def group_by_band(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group records by ``energy_bandpassname`` (e.g. ``SPHEREx-D1``), bands sorted."""
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        groups[record.get(BAND_COLUMN) or UNKNOWN_BAND].append(record)
    return dict(sorted(groups.items()))
