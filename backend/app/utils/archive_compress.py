"""Compress archive uploads (images → JPEG, PDFs) to fit size limit."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".gif"}


def _stem_name(filename: str) -> str:
    stem = Path(filename).stem.strip() or "file"
    return stem[:200]


def compress_image_to_jpeg(data: bytes, filename: str, max_bytes: int) -> tuple[bytes, str] | None:
    """
    Re-encode an image as JPEG under max_bytes (PNG/others → JPEG allowed).
    Returns (bytes, new_filename) or None if impossible / not an image.
    """
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except Exception:
        return None

    if image.mode == "P":
        image = image.convert("RGBA")
    if image.mode in ("RGBA", "LA"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    new_name = f"{_stem_name(filename)}.jpg"
    scales = (1.0, 0.85, 0.7, 0.55, 0.4, 0.3, 0.2)
    qualities = (85, 75, 65, 55, 45, 35, 25, 15)

    for scale in scales:
        if scale < 1.0:
            width = max(1, int(image.width * scale))
            height = max(1, int(image.height * scale))
            work = image.resize((width, height), Image.Resampling.LANCZOS)
        else:
            work = image
        for quality in qualities:
            buffer = BytesIO()
            work.save(buffer, format="JPEG", quality=quality, optimize=True)
            out = buffer.getvalue()
            if len(out) <= max_bytes:
                return out, new_name
    return None


def compress_pdf(data: bytes, filename: str, max_bytes: int) -> tuple[bytes, str] | None:
    """
    Compress a PDF under max_bytes (deflate, then rasterize pages if needed).
    Returns (bytes, filename) or None.
    """
    lower = filename.lower()
    if not (lower.endswith(".pdf") or data[:4] == b"%PDF"):
        return None
    try:
        import fitz
    except ImportError:
        return None

    try:
        source = fitz.open(stream=data, filetype="pdf")
    except Exception:
        return None

    new_name = f"{_stem_name(filename)}.pdf"
    try:
        compacted = source.tobytes(garbage=4, deflate=True, clean=True)
        if len(compacted) <= max_bytes:
            return compacted, new_name

        for dpi in (120, 100, 72, 50, 36):
            for quality in (70, 50, 35, 20):
                destination = fitz.open()
                try:
                    for page in source:
                        zoom = dpi / 72.0
                        pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
                        jpeg_bytes = pixmap.tobytes("jpeg", jpg_quality=quality)
                        img_doc = fitz.open(stream=jpeg_bytes, filetype="jpeg")
                        try:
                            pdf_bytes = img_doc.convert_to_pdf()
                        finally:
                            img_doc.close()
                        img_pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
                        try:
                            destination.insert_pdf(img_pdf)
                        finally:
                            img_pdf.close()
                    result = destination.tobytes(garbage=4, deflate=True)
                finally:
                    destination.close()
                if len(result) <= max_bytes:
                    return result, new_name
        return None
    finally:
        source.close()


def prepare_archive_payload(
    data: bytes,
    filename: str,
    max_bytes: int,
) -> tuple[bytes, str]:
    """
    Keep original if already under limit; otherwise try image/PDF compression.
    Raises ValueError if the file cannot fit under max_bytes.
    """
    if len(data) <= max_bytes:
        return data, filename

    suffix = Path(filename).suffix.lower()
    if suffix in IMAGE_EXTENSIONS or _looks_like_image(data):
        compressed = compress_image_to_jpeg(data, filename, max_bytes)
        if compressed:
            return compressed

    compressed = compress_pdf(data, filename, max_bytes)
    if compressed:
        return compressed

    # Last chance: treat unknown bytes as image if Pillow can open them.
    if suffix not in IMAGE_EXTENSIONS:
        compressed = compress_image_to_jpeg(data, filename, max_bytes)
        if compressed:
            return compressed

    raise ValueError(f"File exceeds limit of {max_bytes} bytes and could not be compressed")


def _looks_like_image(data: bytes) -> bool:
    """Heuristic magic-byte check for common image formats."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if data.startswith(b"\xff\xd8\xff"):
        return True
    if data.startswith(b"RIFF") and b"WEBP" in data[:16]:
        return True
    if data.startswith(b"BM"):
        return True
    if data.startswith((b"GIF87a", b"GIF89a")):
        return True
    return False
