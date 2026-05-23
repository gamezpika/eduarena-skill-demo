"""rembg 去背 hero_iso + boss_iso（含底部小石台一併消除）。

Gemini 雖然 prompt 寫 transparent，但仍輸出 RGB（含淡色底+小石台）。
rembg 用 u2net model 強力去背，可同時清掉背景跟角色腳下的小石台。
"""
import sys
from pathlib import Path
from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
ARENA = ROOT / "assets" / "images" / "arena"

TARGETS = ["hero_iso", "boss_iso"]

for key in TARGETS:
    src = ARENA / f"{key}.png"
    if not src.exists():
        print(f"!! missing: {src}")
        continue
    print(f"-> rembg {key} ({src.stat().st_size // 1024}KB) ...")
    img = Image.open(src)
    out = remove(img)  # returns RGBA
    # 存覆蓋
    out.save(src, "PNG", optimize=True)
    print(f"   saved: {src.name} ({src.stat().st_size // 1024}KB, mode={out.mode})")

print("Done.")
