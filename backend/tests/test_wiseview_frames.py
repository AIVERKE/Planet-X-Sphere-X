import pytest

from services import irsa_sia, wiseview_frames as wv


@pytest.fixture(autouse=True)
def clear_range_cache():
    wv._range_cache.clear()
    yield
    wv._range_cache.clear()


def fake_pairs(level: float) -> list[tuple[str, float]]:
    return [(f"cutouts/{int(level)}-{i}", 55000.0 + i) for i in range(4)]


def install(monkeypatch, brightness: dict[float, tuple[float, float]], failing=()):
    """WiseView falso: cada maxbright devuelve claves propias y un brillo fijo."""
    requested: list[float] = []

    def request_pairs(ra, dec, *, size_px, band, window, maxbright, read_timeout=55.0):
        requested.append(maxbright)
        if maxbright in failing:
            raise irsa_sia.UpstreamServiceError("caído")
        return fake_pairs(maxbright)

    def measure(key: str):
        level = float(key.split("/")[1].split("-")[0])
        return brightness[level]

    monkeypatch.setattr(wv, "_request_pairs", request_pairs)
    monkeypatch.setattr(wv, "_brightness", measure)
    return requested


def keys(meta: dict) -> set[str]:
    return {frame["s3_key"] for frame in meta["frames"]}


def test_normal_field_keeps_default_range(monkeypatch):
    requested = install(monkeypatch, {500.0: (0.04, 29.0)})
    meta = wv.fetch_animation_meta(269.452, 4.6933)
    assert requested == [500.0]
    assert keys(meta) == {key for key, _ in fake_pairs(500.0)}


def test_burnt_field_picks_narrowest_readable_range(monkeypatch):
    # Valores medidos en Orión (83.8221, -5.3911).
    requested = install(
        monkeypatch,
        {
            500.0: (1.0, 255.0),
            5_000.0: (0.97, 255.0),
            25_000.0: (0.6, 240.0),
            150_000.0: (0.0, 84.0),
            1_000_000.0: (0.0, 10.0),
        },
    )
    meta = wv.fetch_animation_meta(83.8221, -5.3911)
    assert requested[0] == 500.0
    assert sorted(requested[1:]) == sorted(wv.MAX_BRIGHT_LADDER)
    assert keys(meta) == {key for key, _ in fake_pairs(150_000.0)}


def test_chosen_range_is_cached_per_position(monkeypatch):
    requested = install(
        monkeypatch,
        {500.0: (1.0, 255.0), **{level: (0.0, 80.0) for level in wv.MAX_BRIGHT_LADDER}},
    )
    wv.fetch_animation_meta(83.8221, -5.3911)
    requested.clear()
    meta = wv.fetch_animation_meta(83.8221, -5.3911)
    assert requested == [5_000.0]
    assert keys(meta) == {key for key, _ in fake_pairs(5_000.0)}


def test_least_saturated_when_none_readable(monkeypatch):
    install(
        monkeypatch,
        {
            500.0: (1.0, 255.0),
            5_000.0: (0.9, 255.0),
            25_000.0: (0.5, 250.0),
            150_000.0: (0.2, 200.0),
            1_000_000.0: (0.1, 190.0),
        },
    )
    meta = wv.fetch_animation_meta(10.0, 10.0)
    assert keys(meta) == {key for key, _ in fake_pairs(1_000_000.0)}


def test_ladder_failure_falls_back_to_default(monkeypatch):
    install(
        monkeypatch,
        {500.0: (1.0, 255.0)},
        failing=set(wv.MAX_BRIGHT_LADDER),
    )
    meta = wv.fetch_animation_meta(10.0, 10.0)
    assert keys(meta) == {key for key, _ in fake_pairs(500.0)}
