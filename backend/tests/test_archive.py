"""Archive endpoint tests."""

from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from tests.conftest import register_user


def _png_bytes(width: int = 40, height: int = 40, color=(20, 180, 90)) -> bytes:
    image = Image.new("RGB", (width, height), color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_archive_upload_list_download_delete(client: TestClient, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ARCHIVE_DIR", str(tmp_path / "archive"))
    monkeypatch.setenv("ARCHIVE_MAX_BYTES", "5242880")
    monkeypatch.setenv("ARCHIVE_UPLOAD_MAX_BYTES", "52428800")
    from app.config import get_settings

    get_settings.cache_clear()

    register_user(client, login="archuser")
    payload = {"note": "скан анализа"}
    raw = _png_bytes()
    files = {"file": ("lab.png", BytesIO(raw), "image/png")}
    created = client.post("/api/v1/archive", data=payload, files=files)
    assert created.status_code == 201
    body = created.json()
    assert body["note"] == "скан анализа"
    assert body["original_name"] == "lab.png"
    assert body["size_bytes"] == len(raw)
    file_id = body["id"]

    listed = client.get("/api/v1/archive")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    downloaded = client.get(f"/api/v1/archive/{file_id}/download")
    assert downloaded.status_code == 200
    assert downloaded.content == raw

    deleted = client.delete(f"/api/v1/archive/{file_id}")
    assert deleted.status_code == 204
    assert client.get("/api/v1/archive").json() == []


def test_archive_compresses_large_png_to_jpeg(client: TestClient, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ARCHIVE_DIR", str(tmp_path / "archive"))
    monkeypatch.setenv("ARCHIVE_MAX_BYTES", "2500")
    monkeypatch.setenv("ARCHIVE_UPLOAD_MAX_BYTES", "5000000")
    from app.config import get_settings

    get_settings.cache_clear()

    register_user(client, login="compressuser")
    image = Image.new("RGB", (600, 600))
    pixels = image.load()
    for y in range(600):
        for x in range(600):
            pixels[x, y] = ((x * 7) % 256, (y * 11) % 256, (x + y) % 256)
    buffer = BytesIO()
    image.save(buffer, format="PNG", compress_level=0)
    raw = buffer.getvalue()
    assert len(raw) > 2500

    response = client.post(
        "/api/v1/archive",
        data={"note": "big scan"},
        files={"file": ("scan.png", BytesIO(raw), "image/png")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["original_name"].endswith(".jpg")
    assert body["size_bytes"] <= 2500
    assert body["size_bytes"] < len(raw)


def test_archive_rejects_oversized_file(client: TestClient, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ARCHIVE_DIR", str(tmp_path / "archive"))
    monkeypatch.setenv("ARCHIVE_MAX_BYTES", "10")
    monkeypatch.setenv("ARCHIVE_UPLOAD_MAX_BYTES", "100")
    from app.config import get_settings

    get_settings.cache_clear()

    register_user(client, login="bigfile")
    files = {"file": ("big.bin", BytesIO(b"0123456789ABCDEF"), "application/octet-stream")}
    response = client.post("/api/v1/archive", data={"note": "too big"}, files=files)
    assert response.status_code == 413


def test_archive_note_too_long(client: TestClient, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ARCHIVE_DIR", str(tmp_path / "archive"))
    from app.config import get_settings

    get_settings.cache_clear()

    register_user(client, login="longnote")
    files = {"file": ("a.txt", BytesIO(b"ok"), "text/plain")}
    response = client.post("/api/v1/archive", data={"note": "x" * 201}, files=files)
    assert response.status_code == 422


def test_archive_limits_endpoint(client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("ARCHIVE_MAX_BYTES", "12345")
    monkeypatch.setenv("ARCHIVE_UPLOAD_MAX_BYTES", "99999")
    from app.config import get_settings

    get_settings.cache_clear()
    response = client.get("/api/v1/archive/limits")
    assert response.status_code == 200
    assert response.json()["max_bytes"] == 12345
    assert response.json()["upload_max_bytes"] == 99999
