"""從派派 PS 畫的「黑線標路徑」圖 (map.jpeg) 萃取 walkable mask。

派派意圖：黑線 = chibi 可走的路。
流程：
1. 讀 map.jpeg → resize 到 1024×1820（跟 world_map_v4.png 對齊）
2. 識別純黑色線條 (V<0.2, S<0.3)
3. dilate 線條到「路徑寬度」(讓 chibi 有空間走)
4. 輸出 world_map_walkable.png + preview
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, binary_closing

ROOT = Path(__file__).resolve().parent.parent
USER_DRAW = ROOT / "assets" / "images" / "map.jpeg"
ORIG_MAP = ROOT / "assets" / "images" / "world_map_v4.png"
OUT_MASK = ROOT / "assets" / "images" / "world_map_walkable.png"
OUT_PREVIEW = ROOT / "assets" / "images" / "world_map_walkable_preview.jpg"

TARGET_W, TARGET_H = 1024, 1820
PATH_WIDTH_PX = 8  # 細線稍微擴張、塗大片保持原狀


def main():
    if not USER_DRAW.exists():
        sys.exit(f"ERROR: {USER_DRAW} not found")

    # 1. 讀派派圖 + resize
    user_img = Image.open(USER_DRAW).convert("RGB")
    print(f"User draw: {user_img.size}")
    if user_img.size != (TARGET_W, TARGET_H):
        user_img = user_img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
        print(f"Resized to: {user_img.size}")

    arr = np.array(user_img).astype(np.float32) / 255

    # 2. 識別黑色線條（純黑 + 容忍 antialiasing 邊緣灰）
    # 條件：所有 RGB channel 都很低（V 低）+ 灰度（S 低）
    v = arr.max(axis=-1)  # value
    s_denom = np.where(v == 0, 1, v)
    s = (v - arr.min(axis=-1)) / s_denom  # saturation
    is_black_line = (v < 0.30) & (s < 0.35)

    print(f"Raw black pixels: {is_black_line.sum()} ({is_black_line.sum() / is_black_line.size * 100:.2f}%)")

    # 3. 填補 antialiasing 小洞 + dilate 加寬路徑
    is_black_line = binary_closing(is_black_line, iterations=2)

    # dilate 用方形 kernel，半徑 PATH_WIDTH_PX // 2 → 路徑寬度 ~PATH_WIDTH_PX
    radius = PATH_WIDTH_PX // 2
    kernel_size = radius * 2 + 1
    kernel = np.ones((kernel_size, kernel_size), dtype=bool)
    # binary_dilation 一次直接擴張 radius 像素
    walkable = binary_dilation(is_black_line, structure=kernel)

    print(f"After dilate ({PATH_WIDTH_PX}px wide): {walkable.sum() / walkable.size * 100:.2f}% walkable")

    # 4. 輸出 walkable mask（純黑白）
    mask = np.where(walkable, 255, 0).astype(np.uint8)
    Image.fromarray(mask, "L").convert("RGB").save(OUT_MASK, "PNG", optimize=True)
    print(f"✓ Mask: {OUT_MASK.name}  {OUT_MASK.stat().st_size // 1024} KB")

    # 5. 預覽：原圖 + 半透明綠色 walkable 覆蓋
    orig = Image.open(ORIG_MAP).convert("RGB").resize((TARGET_W, TARGET_H), Image.LANCZOS)
    orig_arr = np.array(orig)
    overlay = orig_arr.copy()
    green = np.zeros_like(overlay)
    green[..., 1] = 255  # 綠
    alpha = 0.5
    overlay[walkable] = (orig_arr[walkable] * (1 - alpha) + green[walkable] * alpha).astype(np.uint8)
    Image.fromarray(overlay, "RGB").save(OUT_PREVIEW, "JPEG", quality=80, optimize=True)
    print(f"✓ Preview: {OUT_PREVIEW.name}  {OUT_PREVIEW.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
