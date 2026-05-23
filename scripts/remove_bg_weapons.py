"""rembg 去背 5 個武器版本主角。"""
import sys
from pathlib import Path
from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
ARENA = ROOT / "assets" / "images" / "arena"
TARGETS = ["hero_iso_sword", "hero_iso_book", "hero_iso_pencil", "hero_iso_staff", "hero_iso_gauntlet"]

for key in TARGETS:
    src = ARENA / f"{key}.png"
    if not src.exists():
        print(f"!! missing: {src}")
        continue
    print(f"-> rembg {key} ({src.stat().st_size // 1024}KB) ...")
    img = Image.open(src)
    out = remove(img)
    out.save(src, "PNG", optimize=True)
    print(f"   saved: {src.name} ({src.stat().st_size // 1024}KB, mode={out.mode})")
print("Done.")
