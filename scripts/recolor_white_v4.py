"""v4: 位置 mask — 上 35% 頭區保留（眼睛/嘴/髮），下 65% 身體藍→白。"""
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FRAME_DIR = ROOT / "assets" / "images" / "sprites" / "walk"
OUT_DIR = ROOT / "assets" / "images" / "sprites" / "walk_white4"
SHEET = ROOT / "assets" / "images" / "sprites" / "student_walk_sheet_white4.png"
OUT_DIR.mkdir(parents=True, exist_ok=True)

HEAD_RATIO = 0.40  # 上 40% 是頭區，不動


def rgb_to_hsv_np(rgb_float):
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


def recolor(arr):
    rgb = arr[..., :3].astype(np.float32) / 255
    alpha = arr[..., 3]
    h_val, s_val, v_val = rgb_to_hsv_np(rgb)
    is_blue = (h_val >= 0.52) & (h_val <= 0.75) & (s_val > 0.2) & (v_val > 0.05)

    H = arr.shape[0]
    head_cutoff = int(H * HEAD_RATIO)
    # 替換 mask = 藍 且 在頭區以下
    body_mask = np.zeros_like(is_blue, dtype=bool)
    body_mask[head_cutoff:] = True
    replace_mask = is_blue & body_mask

    out = arr.copy()
    if replace_mask.any():
        pixels = np.where(replace_mask)
        v_at = v_val[pixels]
        white_val = (180 + v_at * 75).astype(np.uint8)
        out[pixels[0], pixels[1], 0] = white_val
        out[pixels[0], pixels[1], 1] = white_val
        out[pixels[0], pixels[1], 2] = white_val
    out[alpha < 16] = 0
    return out


def main():
    DIRS = ["south", "north", "east", "west"]
    FRAMES = ["stand", "step1", "stand2", "step2"]
    cell = 128
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))
    print(f"Position-mask recolor (head top {int(HEAD_RATIO*100)}% preserved):")
    for row, d in enumerate(DIRS):
        for col, f in enumerate(FRAMES):
            name = f"{d}_{f}.png"
            src = FRAME_DIR / name
            if not src.exists():
                continue
            img = Image.open(src).convert("RGBA")
            arr = np.array(img)
            new_arr = recolor(arr)
            Image.fromarray(new_arr, "RGBA").save(OUT_DIR / name, "PNG", optimize=True)
            sheet.paste(Image.fromarray(new_arr, "RGBA"), (col * cell, row * cell), Image.fromarray(new_arr, "RGBA"))
            print(f"  ✓ {name}")
    sheet.save(SHEET, "PNG", optimize=True)
    print(f"\n✓ Sheet: {SHEET}")


if __name__ == "__main__":
    main()
