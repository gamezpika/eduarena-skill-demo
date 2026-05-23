"""從 world_map_v4.png 自動萃取 walkable mask（黑白）。

地圖內容：浮島 + 雲海 + 多色建築。
策略：反向萃取 — 標明確「擋區」（雲海/建築彩/水/樹陰）→ 其他當可走 →
morphology 平滑邊緣 → 移除小孤立區。

輸出 3 個 mask 版本（不同閾值）給派派目視選擇。
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "images" / "world_map_v4.png"
OUT_DIR = ROOT / "assets" / "images"


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


def build_mask(img_arr, version):
    """根據版本不同閾值組合生成 walkable mask (h,w) bool（True=可走）"""
    rgb = img_arr.astype(np.float32) / 255
    h, s, v = rgb_to_hsv_np(rgb)

    # 各種「擋區」 mask
    # 1. 雲海 / 天空：藍 (H 200-270) 飽和度中 + 高亮，或純白雲（V 高 S 低）
    sky_blue   = (h >= 0.50) & (h <= 0.72) & (s > 0.15) & (v > 0.45)
    sky_white  = (v > 0.85) & (s < 0.15)

    # 2. 建築物高飽和彩色：紅瓦 H 0-0.04, 紫塔 H 0.7-0.85, 藍頂 H 0.55-0.7
    bright_red    = ((h <= 0.04) | (h >= 0.95)) & (s > 0.4) & (v > 0.35)
    bright_purple = (h >= 0.70) & (h <= 0.85) & (s > 0.35) & (v > 0.25)
    bright_blue_b = (h >= 0.55) & (h <= 0.68) & (s > 0.4) & (v > 0.35)  # 建築藍頂
    bright_yellow = (h >= 0.10) & (h <= 0.18) & (s > 0.55) & (v > 0.55)  # 麥草/旗

    # 3. 深綠樹陰：H 0.25-0.4 + V < 0.4
    dark_tree = (h >= 0.22) & (h <= 0.42) & (v < 0.42) & (s > 0.2)

    # 4. 黑色輪廓邊
    black_edge = v < 0.12

    if version == "A":
        # A 嚴格擋：所有上述當擋區
        blocked = sky_blue | sky_white | bright_red | bright_purple | bright_blue_b | bright_yellow | dark_tree | black_edge
    elif version == "B":
        # B 中等：放寬 sky_white 避免誤判明亮石頭
        sky_white_relaxed = (v > 0.90) & (s < 0.10)
        blocked = sky_blue | sky_white_relaxed | bright_red | bright_purple | bright_blue_b | dark_tree | black_edge
    else:  # C
        # C 寬鬆：只擋雲海 + 明顯建築彩色
        blocked = sky_blue | sky_white | bright_red | bright_purple | bright_blue_b
    walkable = ~blocked

    # Morphology：消除小孤立 walkable 區（< 100 px），平滑邊緣
    # 用簡單 4-connectivity flood fill
    from scipy.ndimage import binary_opening, binary_closing, label

    # 先 closing 補小洞（建築上小孔），再 opening 削小突起
    kernel = np.ones((3, 3), dtype=bool)
    walkable = binary_closing(walkable, structure=kernel, iterations=1)
    walkable = binary_opening(walkable, structure=kernel, iterations=1)

    # 移除小孤立 walkable blob（< 500 px = 雜訊）
    labeled, n = label(walkable, structure=np.ones((3, 3), dtype=int))
    sizes = np.bincount(labeled.ravel())
    too_small = (sizes < 500)
    too_small[0] = False
    walkable[too_small[labeled]] = False

    return walkable


def save_mask(walkable, version, original):
    """輸出兩張：(1) 純黑白 mask (2) 半透明紅疊在原圖上方便目視"""
    h, w = walkable.shape
    # 純 mask
    mask_arr = np.where(walkable[..., None], 255, 0).astype(np.uint8)
    mask_rgb = np.repeat(mask_arr, 3, axis=-1)
    Image.fromarray(mask_rgb, "RGB").save(OUT_DIR / f"world_map_walkable_{version}.png", "PNG", optimize=True)

    # 預覽：原圖 + 紅色擋區疊上
    preview = original.copy()
    blocked = ~walkable
    # 擋區疊紅色半透明
    red_overlay = np.zeros_like(preview)
    red_overlay[..., 0] = 255  # 紅
    alpha = 0.55
    preview[blocked] = (preview[blocked] * (1 - alpha) + red_overlay[blocked] * alpha).astype(np.uint8)
    Image.fromarray(preview, "RGB").save(OUT_DIR / f"world_map_walkable_{version}_preview.jpg", "JPEG", quality=85)


def main():
    if not SRC.exists():
        sys.exit(f"ERROR: {SRC} not found")

    img = Image.open(SRC).convert("RGB")
    arr = np.array(img)
    print(f"Source: {SRC.name} {img.size}")
    print()

    for version in ["A", "B", "C"]:
        print(f"Building mask version {version}…", end=" ", flush=True)
        walkable = build_mask(arr, version)
        save_mask(walkable, version, arr)
        ratio = walkable.sum() / walkable.size * 100
        print(f"walkable {ratio:.1f}%")

    print()
    print("Outputs:")
    for v in ["A", "B", "C"]:
        for suffix in ["", "_preview"]:
            ext = ".png" if not suffix else ".jpg"
            p = OUT_DIR / f"world_map_walkable_{v}{suffix}{ext}"
            print(f"  {p.name}  {p.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
