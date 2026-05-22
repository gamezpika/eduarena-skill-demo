"""把 quantize 後的 sprite 中「藍色衣服」替換成「白色衣服」。

做法：
1. 從 base 抽 16 色 palette
2. 識別藍系 palette index（B 顯著大於 R 跟 G）
3. 把藍系 entries 依亮度映射成白系階層（白 / 淺灰 / 灰 / 深灰邊）
4. 用新 palette 對 16 frame 重新 snap
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "assets" / "3d" / "student_base.png"
FRAME_DIR = ROOT / "assets" / "images" / "sprites" / "walk"
OUT_DIR = ROOT / "assets" / "images" / "sprites" / "walk_white"
SHEET = ROOT / "assets" / "images" / "sprites" / "student_walk_sheet_white.png"
OUT_DIR.mkdir(parents=True, exist_ok=True)

NUM_COLORS = 16


def is_blue(rgb):
    """HSV 寬鬆判斷藍色系，含深藍邊"""
    import colorsys
    r, g, b = int(rgb[0]) / 255, int(rgb[1]) / 255, int(rgb[2]) / 255
    if r == g == b:
        return False  # 灰階
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    # H 0.55~0.72 = 藍色帶 (200~260°)
    # S > 0.3 排除中性灰
    # V > 0.12 排除「接近黑」的輪廓邊（不要改黑邊）
    return 0.52 <= h <= 0.75 and s > 0.3 and v > 0.12


def brightness_to_white(rgb):
    """藍色 → 純白系（只保留輕微陰影）"""
    v = (int(rgb[0]) + int(rgb[1]) + int(rgb[2])) // 3
    if v < 25:
        return (185, 185, 185)  # 最深 → 灰陰影邊（保留輪廓感）
    if v < 70:
        return (240, 240, 240)  # 深 → 淺灰白
    return (255, 255, 255)      # 中亮 → 純白


def extract_palette(base_path, n_colors):
    img = Image.open(base_path).convert("RGBA")
    arr = np.array(img)
    mask = arr[..., 3] > 32
    pixels = arr[mask][..., :3]
    pix_img = Image.fromarray(pixels.reshape(-1, 1, 3), "RGB")
    q = pix_img.quantize(colors=n_colors, dither=Image.NONE)
    return np.array(q.getpalette()[: n_colors * 3]).reshape(n_colors, 3)


def make_white_palette(orig_palette):
    new = []
    for c in orig_palette:
        if is_blue(c):
            new.append(brightness_to_white(c))
        else:
            new.append(tuple(c))
    return np.array(new, dtype=np.int32)


def snap_with_blue_to_white(frame_path, orig_palette, target_palette, out_path):
    """對每個像素：用 orig_palette 找最近 index，輸出對應 target_palette 顏色。"""
    img = Image.open(frame_path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[..., :3].astype(np.int32)
    alpha = arr[..., 3]

    dist = np.sqrt(
        ((rgb[..., None, :] - orig_palette[None, None, :, :]) ** 2).sum(axis=-1)
    )
    idx = dist.argmin(axis=-1)
    snapped = target_palette[idx]

    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., :3] = snapped
    out[..., 3] = alpha
    out[alpha < 16] = 0

    Image.fromarray(out, "RGBA").save(out_path, "PNG", optimize=True)


def main():
    orig = extract_palette(BASE, NUM_COLORS)
    print("Original palette:")
    for i, c in enumerate(orig):
        tag = " ← BLUE" if is_blue(c) else ""
        print(f"  #{i}: rgb({c[0]:3d},{c[1]:3d},{c[2]:3d}){tag}")

    target = make_white_palette(orig)
    print("\nMapped palette (blue→white):")
    for i, (o, t) in enumerate(zip(orig, target)):
        if not np.array_equal(o, t):
            print(f"  #{i}: {tuple(o)} → {tuple(t)}")

    DIRS = ["south", "north", "east", "west"]
    FRAMES = ["stand", "step1", "stand2", "step2"]
    cell = 128
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))

    print("\nRecoloring 16 frames…")
    for row, d in enumerate(DIRS):
        for col, f in enumerate(FRAMES):
            name = f"{d}_{f}.png"
            src = FRAME_DIR / name
            dst = OUT_DIR / name
            if not src.exists():
                continue
            snap_with_blue_to_white(src, orig, target, dst)
            frame_img = Image.open(dst).convert("RGBA")
            sheet.paste(frame_img, (col * cell, row * cell), frame_img)
            print(f"  ✓ {name}")

    sheet.save(SHEET, "PNG", optimize=True)
    print(f"\n✓ Sheet: {SHEET}")


if __name__ == "__main__":
    main()
