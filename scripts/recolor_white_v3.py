"""v3: connected-component 區分眼睛 vs 衣服。

藍色 mask 後用 scipy.ndimage.label 算連通區：
- 大塊 (>= 200 px) = 衣服 → 換成白系（依 V 階層）
- 小塊 (< 200 px) = 眼睛 / 嘴巴 / 小裝飾 → 保留原色
"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parent.parent
FRAME_DIR = ROOT / "assets" / "images" / "sprites" / "walk"
OUT_DIR = ROOT / "assets" / "images" / "sprites" / "walk_white3"
SHEET = ROOT / "assets" / "images" / "sprites" / "student_walk_sheet_white3.png"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 小於這個 pixel 數的藍色塊視為眼睛/嘴巴，不替換
SMALL_BLOB_THRESHOLD = 200


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


def recolor_blue_to_white_cc(arr):
    """Connected component: 大塊藍色換白，小塊保留（眼睛）"""
    rgb = arr[..., :3].astype(np.float32) / 255
    alpha = arr[..., 3]

    h_val, s_val, v_val = rgb_to_hsv_np(rgb)
    is_blue = (h_val >= 0.52) & (h_val <= 0.75) & (s_val > 0.2) & (v_val > 0.05)

    # 連通區分析（8-connectivity）
    structure = np.ones((3, 3), dtype=np.int32)
    labeled, num_blobs = label(is_blue, structure=structure)

    # 對每個 blob 算 size，建 mask
    sizes = np.bincount(labeled.ravel())
    # blob 0 是背景，不算
    big_blob_ids = np.where(sizes >= SMALL_BLOB_THRESHOLD)[0]
    big_blob_ids = big_blob_ids[big_blob_ids != 0]
    # 「大塊藍 mask」= 屬於大 blob 的像素
    big_blue_mask = np.isin(labeled, big_blob_ids)

    out = arr.copy()
    if big_blue_mask.any():
        big_pixels = np.where(big_blue_mask)
        v_at_blue = v_val[big_pixels]
        white_val = (180 + v_at_blue * 75).astype(np.uint8)
        out[big_pixels[0], big_pixels[1], 0] = white_val
        out[big_pixels[0], big_pixels[1], 1] = white_val
        out[big_pixels[0], big_pixels[1], 2] = white_val

    # 小 blob 保留原色，不動

    out[alpha < 16] = 0

    # 統計
    n_blobs = num_blobs
    n_big = len(big_blob_ids)
    n_small = n_blobs - n_big
    return out, n_blobs, n_big, n_small


def main():
    DIRS = ["south", "north", "east", "west"]
    FRAMES = ["stand", "step1", "stand2", "step2"]
    cell = 128
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))

    print(f"Connected-component blue→white (threshold {SMALL_BLOB_THRESHOLD}px):")
    for row, d in enumerate(DIRS):
        for col, f in enumerate(FRAMES):
            name = f"{d}_{f}.png"
            src = FRAME_DIR / name
            dst = OUT_DIR / name
            if not src.exists():
                continue
            img = Image.open(src).convert("RGBA")
            arr = np.array(img)
            new_arr, n_blobs, n_big, n_small = recolor_blue_to_white_cc(arr)
            Image.fromarray(new_arr, "RGBA").save(dst, "PNG", optimize=True)
            sheet.paste(Image.fromarray(new_arr, "RGBA"),
                        (col * cell, row * cell),
                        Image.fromarray(new_arr, "RGBA"))
            print(f"  ✓ {name}  blobs={n_blobs} (big={n_big} clothes, small={n_small} preserved)")

    sheet.save(SHEET, "PNG", optimize=True)
    print(f"\n✓ Sheet: {SHEET}")


if __name__ == "__main__":
    main()
