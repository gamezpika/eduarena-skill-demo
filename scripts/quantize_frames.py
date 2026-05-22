"""C 解法：用 base sprite 的色票 quantize 16 張 frame，強制統一主色。

侷限：只能修「色差」(藍 #58c → 藍 #6ad 漂移)，
無法修「結構錯」(藍背心被畫成藍 T-shirt 整片)。

做法：
1. 從 base sprite 抽 N 種主色（透過 quantize 取 palette）
2. 對 16 幀 frame 用同一 palette quantize
3. 保留 alpha 透明度
4. 重拼 sheet
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "assets" / "3d" / "student_base.png"
FRAME_DIR = ROOT / "assets" / "images" / "sprites" / "walk"
OUT_DIR = ROOT / "assets" / "images" / "sprites" / "walk_q"
SHEET = ROOT / "assets" / "images" / "sprites" / "student_walk_sheet_q.png"
OUT_DIR.mkdir(parents=True, exist_ok=True)

NUM_COLORS = 16  # palette 大小


def extract_palette(base_path: Path, n_colors: int) -> np.ndarray:
    """從 base 取 n_colors 主色（忽略透明像素）"""
    img = Image.open(base_path).convert("RGBA")
    arr = np.array(img)
    # 取不透明像素
    mask = arr[..., 3] > 32
    pixels = arr[mask][..., :3]  # RGB only
    # 用 PIL quantize 取 palette (不用 sklearn 省依賴)
    pix_img = Image.fromarray(pixels.reshape(-1, 1, 3), "RGB")
    q = pix_img.quantize(colors=n_colors, dither=Image.NONE)
    palette = np.array(q.getpalette()[: n_colors * 3]).reshape(n_colors, 3)
    return palette


def snap_to_palette(frame_path: Path, palette: np.ndarray, out_path: Path):
    """對 frame 的每個不透明像素 snap 到 palette 最近色（歐式距離 RGB）"""
    img = Image.open(frame_path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[..., :3].astype(np.int32)
    alpha = arr[..., 3]

    # 計算每個像素到 palette 每色的距離，pick 最近
    # rgb: (h,w,3), palette: (n,3) → dist (h,w,n)
    dist = np.sqrt(((rgb[..., None, :] - palette[None, None, :, :]) ** 2).sum(axis=-1))
    idx = dist.argmin(axis=-1)  # (h,w)
    snapped = palette[idx]  # (h,w,3)

    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., :3] = snapped
    out[..., 3] = alpha
    # 完全透明的也清乾淨
    out[alpha < 16] = 0

    Image.fromarray(out, "RGBA").save(out_path, "PNG", optimize=True)


def main():
    if not BASE.exists():
        print(f"ERROR: base not found {BASE}")
        sys.exit(1)

    palette = extract_palette(BASE, NUM_COLORS)
    print(f"base palette ({NUM_COLORS} colors):")
    for i, c in enumerate(palette):
        print(f"  #{i}: rgb({c[0]},{c[1]},{c[2]})")

    frames = sorted(FRAME_DIR.glob("*.png"))
    print(f"\nQuantizing {len(frames)} frames…")

    DIRECTIONS = ["south", "north", "east", "west"]
    FRAMES = ["stand", "step1", "stand2", "step2"]

    cell = 128
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))

    for row, dir_key in enumerate(DIRECTIONS):
        for col, frame_key in enumerate(FRAMES):
            name = f"{dir_key}_{frame_key}.png"
            src = FRAME_DIR / name
            dst = OUT_DIR / name
            if not src.exists():
                print(f"  ! missing {name}")
                continue
            snap_to_palette(src, palette, dst)
            print(f"  ✓ {name}")
            frame_img = Image.open(dst).convert("RGBA")
            sheet.paste(frame_img, (col * cell, row * cell), frame_img)

    sheet.save(SHEET, "PNG", optimize=True)
    print(f"\n✓ Sheet: {SHEET} {sheet.size}")


if __name__ == "__main__":
    main()
