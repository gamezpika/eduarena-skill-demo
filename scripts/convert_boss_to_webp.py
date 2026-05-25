#!/usr/bin/env python3
"""把 boss/v2/{科}/{tier}/*.png 全部轉 WebP（保留原 PNG）

5 科 × 3 tier × 7 PNG (idle/charge/attack/release/hit/death/bg) = 105 個檔
WebP quality=82 method=6 → 預期縮 75-85%
"""
import os
from pathlib import Path
from PIL import Image
import sys

ROOT = Path(__file__).parent.parent / "assets" / "images" / "boss" / "v2"
SUBJECTS = ["math", "chinese", "english", "science", "social"]
TIERS = ["t1", "t2", "t3"]
FRAMES = ["idle", "charge", "attack", "release", "hit", "death", "bg"]

WEBP_QUALITY = 82
WEBP_METHOD = 6

def convert_one(png_path: Path) -> tuple[int, int]:
    """轉 PNG → WebP，回傳 (原 size, 新 size)。"""
    webp_path = png_path.with_suffix(".webp")
    orig_size = png_path.stat().st_size
    with Image.open(png_path) as im:
        if im.mode not in ("RGBA", "RGB"):
            im = im.convert("RGBA")
        im.save(webp_path, format="WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
    new_size = webp_path.stat().st_size
    return orig_size, new_size

def main():
    total_orig = total_new = 0
    converted = skipped = failed = 0

    for subj in SUBJECTS:
        for tier in TIERS:
            for frame in FRAMES:
                png = ROOT / subj / tier / f"{frame}.png"
                if not png.exists():
                    print(f"  ⚠ missing: {png.relative_to(ROOT)}")
                    skipped += 1
                    continue
                try:
                    o, n = convert_one(png)
                    total_orig += o
                    total_new += n
                    converted += 1
                    pct = (1 - n / o) * 100
                    print(f"  ✓ {subj}/{tier}/{frame}: {o//1024} KB → {n//1024} KB (-{pct:.0f}%)")
                except Exception as e:
                    print(f"  ✗ {subj}/{tier}/{frame}: {e}")
                    failed += 1

    print()
    print(f"=== 完成 ===")
    print(f"轉換: {converted} / 跳過: {skipped} / 失敗: {failed}")
    if total_orig > 0:
        saved_pct = (1 - total_new / total_orig) * 100
        print(f"總 PNG: {total_orig / 1024 / 1024:.1f} MB")
        print(f"總 WebP: {total_new / 1024 / 1024:.1f} MB")
        print(f"節省: {saved_pct:.0f}% ({(total_orig - total_new) / 1024 / 1024:.1f} MB)")

if __name__ == "__main__":
    sys.exit(main())
