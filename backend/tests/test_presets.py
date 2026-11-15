import math

from fastapi.testclient import TestClient

from main import app
from services.preset_motion import propagate_position
from routers.presets import PRESET_LOCATIONS

client = TestClient(app)
URL = "/api/presets"

OFFICIAL_IDS = ["barnard", "eps_indi_b", "wise_0855", "rw_aur", "r_dra"]


def _sep_arcsec(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    dra = math.radians(ra2 - ra1) * math.cos(math.radians((dec1 + dec2) / 2))
    ddec = math.radians(dec2 - dec1)
    return math.degrees(math.hypot(dra, ddec)) * 3600.0


def test_returns_official_and_survey_presets():
    res = client.get(URL)

    assert res.status_code == 200
    body = res.json()
    ids = [p["id"] for p in body]
    assert ids[:5] == OFFICIAL_IDS
    assert {"nep", "sep", "galactic_center"} <= set(ids)
    official = [p for p in body if p["category"] == "official_test"]
    assert [p["name"] for p in official] == [
        "Barnard's Star",
        "Epsilon Indi B",
        "WISE 0855",
        "RW Aurigae",
        "R Draconis",
    ]


def test_category_filter():
    official = client.get(URL, params={"category": "official_test"}).json()
    survey = client.get(URL, params={"category": "survey_field"}).json()

    assert [p["id"] for p in official] == OFFICIAL_IDS
    assert {p["id"] for p in survey} == {"nep", "sep", "galactic_center"}
    assert client.get(URL, params={"category": "nope"}).status_code == 422


def test_preset_ranges_and_fields():
    body = client.get(URL).json()

    assert len({p["id"] for p in body}) == len(body)
    for preset in body:
        assert 0.0 <= preset["ra"] < 360.0
        assert -90.0 <= preset["dec"] <= 90.0
        assert preset["radius_deg"] > 0.0
        assert preset["fov_deg"] > 0.0
        assert preset["category"] in {"official_test", "survey_field"}
        assert preset["highlight"]


def test_coordinates_match_simbad_and_challenge():
    body = {p["id"]: p for p in client.get(URL).json()}

    # SIMBAD J2000 Barnard's Star: 269.45207696, +4.69336497 (< 1″).
    assert _sep_arcsec(body["barnard"]["ra"], body["barnard"]["dec"], 269.45207696, 4.69336497) < 1.0
    # Enunciado WISE 0855: 133.7951, −7.2451.
    assert _sep_arcsec(body["wise_0855"]["ra"], body["wise_0855"]["dec"], 133.7951, -7.2451) < 1.0
    assert body["wise_0855"]["epoch"] == 2010.5


def test_barnard_proper_motion_to_2026():
    """~10.4″/yr × 26 yr ≈ 4.5′ toward the north."""
    catalog = next(p for p in PRESET_LOCATIONS if p.id == "barnard")
    moved = propagate_position(catalog, 2026.0)

    sep_arcmin = _sep_arcsec(catalog.ra, catalog.dec, moved.ra, moved.dec) / 60.0
    assert 4.2 < sep_arcmin < 4.8
    assert moved.dec > catalog.dec
    assert moved.epoch == 2026.0
    assert moved.catalog_epoch == 2000.0

    api = client.get(URL, params={"epoch": 2025.5, "category": "official_test"}).json()
    barnard = next(p for p in api if p["id"] == "barnard")
    assert barnard["dec"] > catalog.dec
    assert barnard["epoch"] == 2025.5


def test_galactic_center_unchanged():
    gc = next(p for p in client.get(URL).json() if p["id"] == "galactic_center")

    assert gc["ra"] == 266.416
    assert gc["dec"] == -29.007
    assert gc["radius_deg"] == 5.0
    assert gc["category"] == "survey_field"


def test_no_double_api_prefix():
    assert client.get("/api/api/presets").status_code == 404
