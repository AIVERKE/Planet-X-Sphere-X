import numpy as np
import pytest
import requests
from astropy.table import MaskedColumn, Table
from fastapi.testclient import TestClient
from pyvo.dal import DALServiceError

from main import app
from services import irsa_sia

client = TestClient(app)
URL = "/api/observations"


def make_table() -> Table:
    return Table(
        {
            "obs_id": ["c", "a", "b", "d"],
            "energy_bandpassname": ["SPHEREx-D2", "SPHEREx-D1", "SPHEREx-D1", "SPHEREx-D2"],
            "t_min": [60300.0, 60100.0, 60200.0, 61000.0],
            "t_max": [60300.1, 60100.1, 60200.1, 61000.1],
            "s_ra": [10.0, np.nan, 10.0, 10.0],
            "t_exptime": MaskedColumn([1, 2, 3, 4], mask=[False, True, False, False]),
            "dataproduct_subtype": [b"spectral_image"] * 4,
            "access_url": [
                "https://irsa.example/c.fits",
                "https://irsa.example/a.fits",
                "https://irsa.example/b.fits?x=1",
                "https://irsa.example/d.fits",
            ],
            "corners": np.zeros((4, 2)),  # multidimensional: must be dropped
        }
    )


@pytest.fixture
def fake_sia(monkeypatch):
    calls = []

    def install(result=None, exc=None):
        def fake_query_sia(**kwargs):
            calls.append(kwargs)
            if exc is not None:
                raise exc
            return result

        monkeypatch.setattr(irsa_sia.Irsa, "query_sia", fake_query_sia)
        return calls

    return install


def test_returns_filtered_sorted_records(fake_sia):
    calls = fake_sia(make_table())
    res = client.get(URL, params={"ra": 10, "dec": 20, "radius": 5, "t_end": 60500})

    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 3
    assert [r["obs_id"] for r in body["observations"]] == ["a", "b", "c"]
    assert body["query"]["collection"] == "spherex_dr1"

    (call,) = calls
    assert call["collection"] == "spherex_dr1"
    coord, radius = call["pos"]
    assert radius.to_value("arcsec") == pytest.approx(5)
    assert coord.ra.deg == pytest.approx(10) and coord.dec.deg == pytest.approx(20)


def test_json_safe_values(fake_sia):
    fake_sia(make_table())
    first = client.get(URL, params={"ra": 10, "dec": 20}).json()["observations"][0]

    assert first["obs_id"] == "a"
    assert first["s_ra"] is None  # NaN -> null
    assert first["t_exptime"] is None  # masked -> null
    assert first["dataproduct_subtype"] == "spectral_image"  # bytes -> str
    assert "corners" not in first


def test_cutout_urls(fake_sia):
    fake_sia(make_table())
    records = client.get(URL, params={"ra": 10.5, "dec": -2, "cutout_size": 0.1}).json()["observations"]
    by_id = {r["obs_id"]: r["cutout_url"] for r in records}

    assert by_id["a"] == "https://irsa.example/a.fits?center=10.5,-2.0&size=0.1"
    assert by_id["b"] == "https://irsa.example/b.fits?x=1&center=10.5,-2.0&size=0.1"


def test_group_by_band(fake_sia):
    fake_sia(make_table())
    body = client.get(URL, params={"ra": 10, "dec": 20, "group_by_band": True}).json()

    assert "observations" not in body
    assert body["count"] == 4
    assert list(body["bands"]) == ["SPHEREx-D1", "SPHEREx-D2"]
    assert [r["obs_id"] for r in body["bands"]["SPHEREx-D2"]] == ["c", "d"]


def test_custom_collection(fake_sia):
    calls = fake_sia(make_table())
    client.get(URL, params={"ra": 10, "dec": 20, "collection": "spherex_dr1_deep"})
    assert calls[0]["collection"] == "spherex_dr1_deep"


def test_no_images_404(fake_sia):
    fake_sia(make_table()[:0])
    res = client.get(URL, params={"ra": 10, "dec": 20})
    assert res.status_code == 404
    assert "No images found" in res.json()["detail"]


def test_none_in_time_window_404(fake_sia):
    fake_sia(make_table())
    res = client.get(URL, params={"ra": 10, "dec": 20, "t_start": 70000, "t_end": 80000})
    assert res.status_code == 404
    assert "none within MJD" in res.json()["detail"]


@pytest.mark.parametrize(
    "exc",
    [
        requests.ConnectionError("boom"),
        requests.Timeout("slow"),
        DALServiceError("down"),
        TimeoutError("socket"),
    ],
)
def test_upstream_errors_503(fake_sia, exc):
    fake_sia(exc=exc)
    res = client.get(URL, params={"ra": 10, "dec": 20})
    assert res.status_code == 503
    assert res.json()["detail"].startswith("IRSA SIA query failed")


@pytest.mark.parametrize(
    "params",
    [
        {"dec": 20},  # missing ra
        {"ra": 400, "dec": 20},
        {"ra": 10, "dec": 100},
        {"ra": 10, "dec": 20, "radius": 0},
        {"ra": 10, "dec": 20, "t_start": 10, "t_end": 5},
        {"ra": 10, "dec": 20, "collection": "bad name;"},
    ],
)
def test_validation_422(fake_sia, params):
    calls = fake_sia(make_table())
    assert client.get(URL, params=params).status_code == 422
    assert calls == []
