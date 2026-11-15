"""Propagate a preset from its catalog epoch to a later year (e.g. SPHEREx ~2025.5)."""

from __future__ import annotations

import warnings

import astropy.units as u
from astropy.coordinates import SkyCoord
from astropy.time import Time
from erfa import ErfaWarning

from schemas.presets import PresetLocation

# Far distance + no radial velocity: we only want the angular proper motion.
# A real parallax would wobble nearby stars by <1″, far below the ~4.5′ shift of Barnard's Star.
_PM_DISTANCE = 1e6 * u.pc


def propagate_position(preset: PresetLocation, target_epoch: float) -> PresetLocation:
    """Return a copy whose ra/dec are at ``target_epoch``.

    Survey fields and objects without proper motion are returned unchanged.
    """
    if preset.pm_ra is None or preset.pm_dec is None:
        return preset
    if abs(target_epoch - preset.epoch) < 1e-6:
        return preset

    coord = SkyCoord(
        ra=preset.ra * u.deg,
        dec=preset.dec * u.deg,
        pm_ra_cosdec=preset.pm_ra * u.mas / u.yr,
        pm_dec=preset.pm_dec * u.mas / u.yr,
        distance=_PM_DISTANCE,
        obstime=Time(preset.epoch, format="decimalyear"),
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ErfaWarning)
        moved = coord.apply_space_motion(Time(target_epoch, format="decimalyear"))

    ra = float(moved.ra.wrap_at(360 * u.deg).deg) % 360.0
    dec = float(moved.dec.deg)
    return preset.model_copy(
        update={
            "ra": ra,
            "dec": dec,
            "epoch": target_epoch,
            "catalog_ra": preset.ra,
            "catalog_dec": preset.dec,
            "catalog_epoch": preset.epoch,
        }
    )
