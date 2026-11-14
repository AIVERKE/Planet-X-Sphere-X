from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
URL = "/api/presets"


def test_returns_all_presets():
    res = client.get(URL)

    assert res.status_code == 200
    body = res.json()
    assert [p["id"] for p in body] == ["nep", "sep", "galactic_center"]


def test_preset_shape_and_ranges():
    body = client.get(URL).json()

    assert len({p["id"] for p in body}) == len(body)
    for preset in body:
        assert set(preset) == {"id", "name", "ra", "dec", "radius_deg", "description"}
        assert 0.0 <= preset["ra"] < 360.0
        assert -90.0 <= preset["dec"] <= 90.0
        assert preset["radius_deg"] > 0.0


def test_galactic_center_values():
    gc = next(p for p in client.get(URL).json() if p["id"] == "galactic_center")

    assert gc["ra"] == 266.416
    assert gc["dec"] == -29.007
    assert gc["radius_deg"] == 5.0


def test_no_double_api_prefix():
    assert client.get("/api/api/presets").status_code == 404
