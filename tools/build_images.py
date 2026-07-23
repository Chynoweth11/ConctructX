#!/usr/bin/env python3
"""Generate responsive, deduplicated image variants for the ConstructX site.

Source photography lives in `assets/images/source/`. This script emits width
variants in WebP and JPEG into `assets/images/` so the markup can ship a
`<picture>` with a real `srcset` instead of one oversized JPEG per slot.

Run it after adding or replacing a source photo:

    python tools/build_images.py

Output filenames are stable (`<name>-<width>.<ext>`), so the HTML does not need
to change when a photo is re-exported.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - depends on local environment
    sys.exit("Pillow is required: pip install Pillow")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "assets" / "images" / "source"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "images"
MANIFEST = OUTPUT_DIR / "manifest.json"

# Width ladders tuned to how each image is actually used on the page.
RECIPES: dict[str, dict] = {
    "hero-mountain-residence": {"widths": (960, 1440, 1920), "quality": 74},
    "north-star": {"widths": (640, 960, 1280), "quality": 78},
    "cascade": {"widths": (640, 960, 1280), "quality": 78},
    "aster": {"widths": (480, 640, 900), "quality": 80},
    "belief-band": {"widths": (960, 1440, 1920), "quality": 72},
    "site-update": {"widths": (200, 400), "quality": 80},
}


def load(path: Path) -> Image.Image:
    image = Image.open(path)
    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


def plan_widths(requested: tuple[int, ...], native: int) -> list[int]:
    """Clamp the width ladder to the source image and drop duplicates.

    A 626px source asked for 480/640/900 should emit 480 and 626 — not 480
    alone, which would throw away resolution the source actually has.
    """
    widths = sorted({min(width, native) for width in requested})
    return widths


def dominant_color(image: Image.Image) -> str:
    """Average color, used as a CSS placeholder while the photo decodes."""
    pixel = image.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return "#{:02x}{:02x}{:02x}".format(*pixel[:3])


def emit(image: Image.Image, stem: str, width: int, quality: int) -> list[Path]:
    if width >= image.width:
        resized = image.copy()
    else:
        height = round(image.height * (width / image.width))
        resized = image.resize((width, height), Image.LANCZOS)

    written: list[Path] = []

    webp_path = OUTPUT_DIR / f"{stem}-{resized.width}.webp"
    resized.save(webp_path, "WEBP", quality=quality, method=6)
    written.append(webp_path)

    jpeg_path = OUTPUT_DIR / f"{stem}-{resized.width}.jpg"
    resized.save(
        jpeg_path,
        "JPEG",
        quality=quality + 4,
        optimize=True,
        progressive=True,
        subsampling=1,
    )
    written.append(jpeg_path)

    return written


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--clean",
        action="store_true",
        help="delete previously generated variants before rebuilding",
    )
    args = parser.parse_args()

    if not SOURCE_DIR.is_dir():
        sys.exit(f"Missing source directory: {SOURCE_DIR}")

    if args.clean:
        for existing in OUTPUT_DIR.glob("*-[0-9]*.*"):
            existing.unlink()

    manifest: dict[str, dict] = {}
    total_bytes = 0

    for stem, recipe in RECIPES.items():
        source = next(SOURCE_DIR.glob(f"{stem}.*"), None)
        if source is None:
            print(f"  skip   {stem} (no source file)")
            continue

        image = load(source)
        entry = {
            "source": source.name,
            "sourceHash": digest(source),
            "intrinsic": {"width": image.width, "height": image.height},
            "placeholder": dominant_color(image),
            "variants": [],
        }

        for width in plan_widths(recipe["widths"], image.width):
            for produced in emit(image, stem, width, recipe["quality"]):
                size = produced.stat().st_size
                total_bytes += size
                entry["variants"].append(
                    {
                        "file": produced.name,
                        "width": Image.open(produced).width,
                        "bytes": size,
                    }
                )

        manifest[stem] = entry
        widths = sorted({v["width"] for v in entry["variants"]})
        print(f"  build  {stem}: {widths} -> {len(entry['variants'])} files")

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {len(manifest)} image sets, {total_bytes / 1024:.0f} KB total.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
