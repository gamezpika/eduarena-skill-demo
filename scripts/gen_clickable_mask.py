"""根據 world_map_config.json 生成點擊遮罩 PNG。

流程：
1. 讀 JSON
2. 建立 1024×1820 黑底 RGB Image
3. 依 render_order 由小到大畫每個 building bbox（用 mask_color 填）
   → 大的 render_order 後畫，蓋在前面（深度排序）
4. 輸出 assets/images/world_clickable_mask.png

用途：
- 點地圖時 sample pixel 顏色 → match buildings[].mask_color → 找出 building id
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "assets" / "world_map_config.json"
OUT = ROOT / "assets" / "images" / "world_clickable_mask.png"


def hex_to_rgb(hex_str):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def main():
    with open(CONFIG) as f:
        cfg = json.load(f)["map_config"]

    W = cfg["dimensions"]["width"]
    H = cfg["dimensions"]["height"]
    buildings = sorted(cfg["buildings"], key=lambda b: b["render_order"])

    img = Image.new("RGB", (W, H), (0, 0, 0))  # 黑底 = 沒建築
    draw = ImageDraw.Draw(img)

    print(f"Painting {len(buildings)} buildings ({W}×{H})…")
    for b in buildings:
        color = hex_to_rgb(b["mask_color"])
        # 優先用 polygon，沒有才 fallback bbox
        if "polygon" in b and len(b["polygon"]) >= 3:
            verts = [(int(v["x"] * W), int(v["y"] * H)) for v in b["polygon"]]
            draw.polygon(verts, fill=color)
            print(f"  [{b['render_order']:4d}] {b['id']:18s} polygon {len(verts)} 點  {b['mask_color']}")
        else:
            bb = b["bounding_box"]
            x1 = int(bb["x_min"] * W); y1 = int(bb["y_min"] * H)
            x2 = int(bb["x_max"] * W); y2 = int(bb["y_max"] * H)
            draw.rectangle([x1, y1, x2, y2], fill=color)
            print(f"  [{b['render_order']:4d}] {b['id']:18s} bbox  {b['mask_color']}")

    img.save(OUT, "PNG", optimize=True)
    print()
    print(f"✓ {OUT}  {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
