import numpy as np
import pytest
import requests
from astropy.table import Table
from fastapi.testclient import TestClient
from pyvo.dal import DALServiceError

from main import app
from services import irsa_catalog

client = TestClient(app)
URL = "/api/catalog"


def make_gaia_table() -> Table:
    return Table(
        {
            "designation": [
                "Gaia DR3 111",
                "Gaia DR3 222",
                "Gaia DR3 333",
                "Gaia DR3 444",
            ],
            "source_id": [111, 222, 333, 444],
            "ra": [270.001, 270.002, 270.003, np.nan],
            "dec": [66.5601, 66.5602, 66.5603, 66.5604],
            "phot_g_mean_mag": [16.0, 12.0, 14.0, 11.0],
            "pmra": [-1.0, -798.0, np.nan, 0.5],
            "pmdec": [2.0, 10328.0, 3.0, -0.2],
        }
    )


def make_allwise_table() -> Table:
    return Table(
        {
            "designation": [b"J180000.00+663336.0", "J180001.00+663337.0"],
            "ra": [270.0, 270.01],
            "dec": [66.56, 66.57],
            "w1mpro": [10.5, 13.2],
            "w2mpro": [10.1, 12.8],
            "ph_qual": ["AAU", "BBB"],
        }
    )


@pytest.fixture
def fake_region(monkeypatch):
    calls = []

    def install(result=None, exc=None):
        def fake_query_region(*args, **kwargs):
            calls.append({"args": args, "kwargs": kwargs})
            if exc is not None:
                raise exc
            return result

        monkeypatch.setattr(irsa_catalog.Irsa, "query_region", fake_query_region)
        return calls

    return install


def test_returns_normalized_gaia_sources(fake_region):
    calls = fake_region(make_gaia_table())
    res = client.get(URL, params={"ra": 270, "dec": 66.56, "radius": 30})

    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 4
    assert body["query"]["catalog"] == "gaia_dr3"
    assert body["query"]["limit"] == 100
    assert body["query"]["mag_max"] is None

    # Brighter first (mag ascending).
    assert [s["id"] for s in body["sources"]] == ["444", "222", "333", "111"]
    first = body["sources"][0]
    assert set(first) == {"id", "name", "ra", "dec", "catalog", "mag", "pmra", "pmdec"}
    assert first["name"] == "Gaia DR3 444"
    assert first["catalog"] == "gaia_dr3"
    assert first["mag"] == pytest.approx(11.0)

    bright = next(s for s in body["sources"] if s["id"] == "222")
    assert bright["pmra"] == pytest.approx(-798.0)
    assert bright["pmdec"] == pytest.approx(10328.0)

    (call,) = calls
    assert call["kwargs"]["catalog"] == "gaia_dr3_source"
    assert call["kwargs"]["spatial"] == "Cone"
    assert call["kwargs"]["radius"].to_value("arcsec") == pytest.approx(30)
    coord = call["args"][0]
    assert coord.ra.deg == pytest.approx(270) and coord.dec.deg == pytest.approx(66.56)


def test_json_safe_nan_values(fake_region):
    fake_region(make_gaia_table())
    sources = client.get(URL, params={"ra": 270, "dec": 66.56}).json()["sources"]
    dim = next(s for s in sources if s["id"] == "111")
    nan_ra = next(s for s in sources if s["id"] == "444")
    mid = next(s for s in sources if s["id"] == "333")

    assert nan_ra["ra"] is None
    assert mid["pmra"] is None
    assert dim["pmra"] == pytest.approx(-1.0)


def test_allwise_catalog(fake_region):
    calls = fake_region(make_allwise_table())
    body = client.get(
        URL, params={"ra": 270, "dec": 66.56, "catalog": "allwise"}
    ).json()

    assert body["query"]["catalog"] == "allwise"
    assert body["count"] == 2
    assert [s["mag"] for s in body["sources"]] == [pytest.approx(10.5), pytest.approx(13.2)]
    first = body["sources"][0]
    assert first["name"] == "J180000.00+663336.0"  # bytes decoded
    assert first["id"] == "J180000.00+663336.0"
    assert first["catalog"] == "allwise"
    assert first["pmra"] is None and first["pmdec"] is None
    assert calls[0]["kwargs"]["catalog"] == "allwise_p3as_psd"


def test_mag_max_and_limit(fake_region):
    fake_region(make_gaia_table())
    body = client.get(
        URL, params={"ra": 270, "dec": 66.56, "mag_max": 14.0, "limit": 2}
    ).json()

    # mag <= 14: 11, 12, 14 → then limit 2 → brightest two
    assert body["count"] == 2
    assert [s["mag"] for s in body["sources"]] == [pytest.approx(11.0), pytest.approx(12.0)]
    assert body["query"]["mag_max"] == pytest.approx(14.0)
    assert body["query"]["limit"] == 2


def test_no_sources_404(fake_region):
    fake_region(make_gaia_table()[:0])
    res = client.get(URL, params={"ra": 270, "dec": 66.56})
    assert res.status_code == 404
    assert "No sources found" in res.json()["detail"]


def test_mag_max_filters_everything_404(fake_region):
    fake_region(make_gaia_table())
    res = client.get(URL, params={"ra": 270, "dec": 66.56, "mag_max": 5.0})
    assert res.status_code == 404


@pytest.mark.parametrize(
    "exc",
    [
        requests.ConnectionError("boom"),
        requests.Timeout("slow"),
        DALServiceError("down"),
        TimeoutError("socket"),
        ValueError("bad catalog"),
    ],
)
def test_upstream_errors_503(fake_region, exc):
    fake_region(exc=exc)
    res = client.get(URL, params={"ra": 270, "dec": 66.56})
    assert res.status_code == 503
    assert res.json()["detail"].startswith("IRSA catalog query failed")


@pytest.mark.parametrize(
    "params",
    [
        {"dec": 66.56},  # missing ra
        {"ra": 400, "dec": 66.56},
        {"ra": 270, "dec": 100},
        {"ra": 270, "dec": 66.56, "radius": 0},
        {"ra": 270, "dec": 66.56, "limit": 0},
        {"ra": 270, "dec": 66.56, "limit": 501},
        {"ra": 270, "dec": 66.56, "catalog": "spherex"},
        {"ra": 270, "dec": 66.56, "catalog": "bad name;"},
    ],
)
def test_validation_422(fake_region, params):
    calls = fake_region(make_gaia_table())
    assert client.get(URL, params=params).status_code == 422
    assert calls == []
