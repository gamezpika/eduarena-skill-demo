"""v2: per-pixel HSV 判斷，所有「藍色像素」直接替換成白。

不靠 palette quantize，從原始 chroma-key 後的 walk/ frame 直接處理。
這樣抓得到 quantize 會漏掉的「中等藍」「暗藍」等變體。
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FRAME_DIR = ROOT / "assets" / "images" / "sprites" / "walk"
OUT_DIR = ROOT / "assets" / "images" / "sprites" / "walk_white2"
SHEET = ROOT / "assets" / "images" / "sprites" / "student_walk_sheet_white2.png"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def rgb_to_hsv_np(rgb_float):
    """rgb_float: (h, w, 3) in [0, 1] → returns (h, s, v) each (h, w) in [0, 1]"""
    mx = rgb_float.max(axis=-1)
    mn = rgb_float.min(axis=-1)
    delta = mx - mn
    delta_safe = np.where(delta == 0, 1, delta)

    h_val = np.zeros_like(mx)
    r, g, b = rgb_float[..., 0], rgb_float[..., 1], rgb_float[..., 2]
    mask_r = (mx == r) & (delta > 0)
    h_val[mask_r] = ((g[mask_r] - b[mask_r]) / delta_safe[mask_r]) % 6
    mask_g = (mx == g) & (delta > 0) & ~mask_r
    h_val[mask_g] = (b[mask_g] - r[mask_g]) / delta_safe[mask_g] + 2
    mask_b = (mx == b) & (delta > 0) & ~mask_r & ~mask_g
    h_val[mask_b] = (r[mask_b] - g[mask_b]) / delta_safe[mask_b] + 4
    h_val = (h_val / 6) % 1

    s_val = np.where(mx > 0, delta / np.where(mx == 0, 1, mx), 0)
    v_val = mx
    return h_val, s_val, v_val


def recolor_blue_to_white(arr):
    """arr: (h, w, 4) uint8. 藍色像素 → 白色階層。"""
    rgb = arr[..., :3].astype(np.float32) / 255
    alpha = arr[..., 3]

    h_val, s_val, v_val = rgb_to_hsv_np(rgb)

    # 藍色 mask：H 0.52~0.75 (200°~270°), S > 0.2, V > 0.05
    is_blue = (h_val >= 0.52) & (h_val <= 0.75) & (s_val > 0.2) & (v_val > 0.05)
    # 但要排除背包（咖啡棕色一般 H ~0.05~0.1，不會撞）

    # 替換：藍色 → 白系階層，依 V 控制亮度（保留陰影感）
    # V 越亮 → 越白；V 越暗 → 灰白邊（180~210）
    out = arr.copy()
    blue_pixels = np.where(is_blue)
    if len(blue_pixels[0]) > 0:
        v_at_blue = v_val[blue_pixels]
        # 映射 V 到白色階層 [180, 255]
        white_val = (180 + v_at_blue * 75).astype(np.uint8)
        out[blue_pixels[0], blue_pixels[1], 0] = white_val
        out[blue_pixels[0], blue_pixels[1], 1] = white_val
        out[blue_pixels[0], blue_pixels[1], 2] = white_val

    # 清完全透明
    out[alpha < 16] = 0
    return out


def main():
    DIRS = ["south", "north", "east", "west"]
    FRAMES = ["stand", "step1", "stand2", "step2"]
    cell = 128
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))

    print("Per-pixel HSV recolor 16 frames…")
    for row, d in enumerate(DIRS):
        for col, f in enumerate(FRAMES):
            name = f"{d}_{f}.png"
            src = FRAME_DIR / name
            dst = OUT_DIR / name
            if not src.exists():
                print(f"  ! missing {name}")
                continue
            img = Image.open(src).convert("RGBA")
            arr = np.array(img)
            new_arr = recolor_blue_to_white(arr)
            Image.fromarray(new_arr, "RGBA").save(dst, "PNG", optimize=True)
            frame_img = Image.fromarray(new_arr, "RGBA")
            sheet.paste(frame_img, (col * cell, row * cell), frame_img)
            print(f"  ✓ {name}")

    sheet.save(SHEET, "PNG", optimize=True)
    print(f"\n✓ Sheet: {SHEET}")


if __name__ == "__main__":
    main()
