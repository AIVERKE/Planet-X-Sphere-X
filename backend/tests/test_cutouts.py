import io

import numpy as np
import pytest
import requests
from astropy.io import fits
from astropy.table import Table
from fastapi.testclient import TestClient
from PIL import Image

from main import app
from services import irsa_sia, spherex_cutouts

client = TestClient(app)
PNG_URL = "/api/cutouts/png"
FRAMES_URL = "/api/observations/frames"
IRSA = "https://irsa.ipac.caltech.edu/data/SPHEREx/cutouts/demo.fits"


def science_header(ra: float, dec: float, size_deg: float, n: int, tilt_deg: float = 0.0) -> fits.Header:
    header = fits.Header()
    theta = np.deg2rad(tilt_deg)
    scale = size_deg / n
    cos_t, sin_t = float(np.cos(theta)), float(np.sin(theta))
    header["CTYPE1"] = "RA---TAN"
    header["CTYPE2"] = "DEC--TAN"
    header["CUNIT1"] = "deg"
    header["CUNIT2"] = "deg"
    header["CRVAL1"] = ra
    header["CRVAL2"] = dec
    header["CRPIX1"] = (n + 1) / 2.0
    header["CRPIX2"] = (n + 1) / 2.0
    header["CD1_1"] = -scale * cos_t
    header["CD1_2"] = scale * sin_t
    header["CD2_1"] = scale * sin_t
    header["CD2_2"] = scale * cos_t
    header["EQUINOX"] = 2000.0
    header["BUNIT"] = "MJy / sr"
    return header


def synthetic_fits(
    ra: float = 10.0,
    dec: float = 20.0,
    size_deg: float = 0.05,
    n: int = 64,
    background: float = 1.0,
    source: float = 80.0,
    tilt_deg: float = 25.0,
) -> bytes:
    """MEF with a flat decoy HDU before IMAGE, plus FLAGS and VARIANCE."""
    data = np.full((n, n), background, dtype=np.float32)
    margin = max(2, n // 5)
    data[margin : n - margin, margin : n - margin] = source
    hdul = fits.HDUList(
        [
            fits.PrimaryHDU(),
            fits.ImageHDU(np.full((n, n), 3.0, dtype=np.float32), name="NOISE"),
            fits.ImageHDU(data, header=science_header(ra, dec, size_deg, n, tilt_deg), name="IMAGE"),
            fits.ImageHDU(np.zeros((n, n), dtype=np.int32), name="FLAGS"),
            fits.ImageHDU(np.ones((n, n), dtype=np.float32), name="VARIANCE"),
        ]
    )
    buffer = io.BytesIO()
    hdul.writeto(buffer)
    return buffer.getvalue()


def http_response(status: int, content: bytes = b"", location: str | None = None) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response._content = content
    if location is not None:
        response.headers["Location"] = location
    return response


@pytest.fixture
def cache(monkeypatch, tmp_path):
    monkeypatch.setattr(spherex_cutouts, "cache_dir", lambda: tmp_path)
    return tmp_path


def test_png_signature_and_contrast(cache, monkeypatch):
    payload = synthetic_fits()
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return http_response(200, payload)

    monkeypatch.setattr(spherex_cutouts.requests, "get", fake_get)
    res = client.get(PNG_URL, params={"url": IRSA, "ra": 10, "dec": 20, "size": 0.05})

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("image/png")
    assert res.content.startswith(b"\x89PNG\r\n\x1a\n")
    image = np.asarray(Image.open(io.BytesIO(res.content)))
    assert image.shape == (spherex_cutouts.OUTPUT_PIXELS, spherex_cutouts.OUTPUT_PIXELS)
    center = image[80:112, 80:112].mean()
    corner = image[:16, :16].mean()
    assert center > corner
    assert image.max() > image.min()
    assert calls == [IRSA]


def test_shared_scale_keeps_constant_source():
    source = 80.0
    faint = np.full((48, 48), 5.0)
    bright_bg = np.full((48, 48), 40.0)
    faint[16:32, 16:32] = source
    bright_bg[16:32, 16:32] = source

    vmin, vmax = spherex_cutouts.stretch_limits([faint, bright_bg])
    assert np.isfinite(vmin) and np.isfinite(vmax) and vmax > vmin
    from_faint = spherex_cutouts.stretch_to_uint8(faint, vmin, vmax)
    from_bright = spherex_cutouts.stretch_to_uint8(bright_bg, vmin, vmax)
    assert from_faint[24, 24] == from_bright[24, 24]

    explicit_faint = spherex_cutouts.stretch_to_uint8(faint, 0.0, 100.0)
    explicit_bright = spherex_cutouts.stretch_to_uint8(bright_bg, 0.0, 100.0)
    assert explicit_faint[24, 24] == explicit_bright[24, 24]
    assert explicit_faint[0, 0] != explicit_bright[0, 0]


def test_png_cache_skips_second_download(cache, monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return http_response(200, synthetic_fits(tilt_deg=0.0))

    monkeypatch.setattr(spherex_cutouts.requests, "get", fake_get)
    params = {"url": IRSA, "ra": 10, "dec": 20, "size": 0.05, "vmin": 0, "vmax": 100}
    first = client.get(PNG_URL, params=params)
    second = client.get(PNG_URL, params=params)

    assert first.status_code == 200
    assert second.content == first.content
    assert calls == [IRSA]


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example/cutout.fits",
        "http://irsa.ipac.caltech.edu/cutout.fits",
        "https://user:pass@irsa.ipac.caltech.edu/cutout.fits",
        "https://irsa.ipac.caltech.edu.evil/cutout.fits",
        "https://evil.example/irsa.ipac.caltech.edu/cutout.fits",
    ],
)
def test_rejects_non_irsa_url(cache, monkeypatch, url):
    def fake_get(*args, **kwargs):
        raise AssertionError("network should not be called")

    monkeypatch.setattr(spherex_cutouts.requests, "get", fake_get)
    res = client.get(PNG_URL, params={"url": url, "ra": 10, "dec": 20, "size": 0.05})
    assert res.status_code == 400
    assert "irsa.ipac.caltech.edu" in res.json()["detail"]


def test_rejects_redirect_off_irsa(cache, monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return http_response(302, location="https://evil.example/stolen.fits")

    monkeypatch.setattr(spherex_cutouts.requests, "get", fake_get)
    res = client.get(PNG_URL, params={"url": IRSA, "ra": 10, "dec": 20, "size": 0.05})

    assert res.status_code == 400
    assert "redirect" in res.json()["detail"]
    assert calls == [IRSA]


def _install_sia(monkeypatch, table: Table):
    def fake_query_sia(**kwargs):
        return table

    monkeypatch.setattr(irsa_sia.Irsa, "query_sia", fake_query_sia)


def _frame_table() -> Table:
    return Table(
        {
            "obs_id": ["d2-late", "d1", "d2-early", "d2-mid"],
            "energy_bandpassname": ["SPHEREx-D2", "SPHEREx-D1", "SPHEREx-D2", "SPHEREx-D2"],
            "t_min": [60300.0, 60100.0, 60150.0, 60200.0],
            "t_max": [60300.1, 60100.1, 60150.1, 60200.1],
            "access_url": [
                "https://irsa.ipac.caltech.edu/data/late.fits",
                "https://irsa.ipac.caltech.edu/data/d1.fits",
                "https://irsa.ipac.caltech.edu/data/early.fits",
                "https://irsa.ipac.caltech.edu/data/mid.fits",
            ],
        }
    )


def test_frames_filters_sorts_and_builds_png_url(monkeypatch):
    _install_sia(monkeypatch, _frame_table())
    seen = {}

    def fake_stretch(urls, ra, dec, size):
        seen["urls"] = list(urls)
        seen["ra"] = ra
        seen["dec"] = dec
        return 1.25, 9.5

    monkeypatch.setattr(spherex_cutouts, "shared_stretch", fake_stretch)
    res = client.get(FRAMES_URL, params={"ra": 10.5, "dec": -2, "band": "D2", "cutout_size": 0.08})

    assert res.status_code == 200
    body = res.json()
    assert body["band"] == "D2"
    assert body["available_bands"] == ["D1", "D2"]
    assert [frame["obs_id"] for frame in body["frames"]] == ["d2-early", "d2-mid", "d2-late"]
    assert body["matched"] == 3
    assert body["returned"] == 3
    assert body["vmin"] == pytest.approx(1.25)
    assert body["vmax"] == pytest.approx(9.5)
    png_url = body["frames"][0]["png_url"]
    assert png_url.startswith("/api/cutouts/png?")
    assert "vmin=1.25" in png_url
    assert "vmax=9.5" in png_url
    assert png_url.find("/api/cutouts/png?") == 0
    assert seen["ra"] == pytest.approx(10.5)
    assert seen["dec"] == pytest.approx(-2)
    assert all(url.startswith("https://irsa.ipac.caltech.edu/") for url in seen["urls"])
    assert [frame["t_min"] for frame in body["frames"]] == sorted(frame["t_min"] for frame in body["frames"])


def test_frames_default_band_and_cap(monkeypatch):
    n = 20
    table = Table(
        {
            "obs_id": [f"id{i:02d}" for i in range(n)] + ["only-d1"],
            "energy_bandpassname": ["SPHEREx-D2"] * n + ["SPHEREx-D1"],
            "t_min": [60000.0 + i for i in range(n)] + [59000.0],
            "t_max": [60000.2 + i for i in range(n)] + [59000.2],
            "access_url": [f"https://irsa.ipac.caltech.edu/data/{i}.fits" for i in range(n + 1)],
        }
    )
    _install_sia(monkeypatch, table)
    seen = {}

    def fake_stretch(urls, ra, dec, size):
        seen["n"] = len(urls)
        return 0.0, 1.0

    monkeypatch.setattr(spherex_cutouts, "shared_stretch", fake_stretch)
    body = client.get(FRAMES_URL, params={"ra": 133.7951, "dec": -7.2451}).json()

    assert body["band"] == "D2"
    assert body["matched"] == 20
    assert body["returned"] == 16
    assert seen["n"] == 16
    assert body["frames"][0]["obs_id"] == "id00"
    assert body["frames"][-1]["obs_id"] == "id19"
    assert body["frames"][0]["band"] == "D2"


def test_frames_missing_band_404(monkeypatch):
    _install_sia(monkeypatch, _frame_table())
    monkeypatch.setattr(spherex_cutouts, "shared_stretch", lambda *args, **kwargs: (0.0, 1.0))
    res = client.get(FRAMES_URL, params={"ra": 10, "dec": 20, "band": "D6"})
    assert res.status_code == 404
    assert "SPHEREx-D6" in res.json()["detail"]


def test_frames_bad_band_422(monkeypatch):
    _install_sia(monkeypatch, _frame_table())

    def explode(*args, **kwargs):
        raise AssertionError("stretch should not run")

    monkeypatch.setattr(spherex_cutouts, "shared_stretch", explode)
    res = client.get(FRAMES_URL, params={"ra": 10, "dec": 20, "band": "nope"})
    assert res.status_code == 422
