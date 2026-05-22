"""生 chibi 學生 4 方向 × 4 幀 walk cycle sprite sheet (16 幀)。

流程：i2i 餵 student_base.png 鎖畫風，每幀獨立 prompt 不同姿勢/朝向。
chroma-key 去背（綠底）+ bbox 裁 + resize 統一 → PIL 拼 4x4 sheet (512x512)。
"""
import io
import os
import sys
import time
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv

# 借用 EduArena 的 .env (含 GEMINI_API_KEY)
load_dotenv("/home/gamezpika/eduarena/.env")

from google import genai
from PIL import Image

MODEL = "gemini-2.5-flash-image"
BASE = ROOT / "assets" / "3d" / "student_base.png"
OUT_DIR = ROOT / "assets" / "images" / "sprites" / "walk"
SHEET = ROOT / "assets" / "images" / "sprites" / "student_walk_sheet.png"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 4 方向 × 4 幀
# 每方向：frame0 站立 / frame1 抬左腳 / frame2 站立 / frame3 抬右腳
# 但 i2i 我們生 3 unique frame 然後 sheet 用 0,1,0,2 排列
# 為求 16 幀獨立看 Codex 跨幀能力，直接生 16 張獨立
DIRECTIONS = [
    ("south", "facing forward toward viewer (front view, can see the face clearly)"),
    ("north", "facing AWAY from viewer (back view, showing the back of the head and backpack, NO face visible)"),
    ("east",  "facing right (left side profile view, body turned to the right)"),
    ("west",  "facing left (right side profile view, body turned to the left)"),
]

FRAMES = [
    ("stand", "standing still, both feet together, arms relaxed at sides"),
    ("step1", "walking, LEFT leg lifted forward in mid-step, RIGHT leg planted, arms swinging slightly"),
    ("stand2","standing still, both feet together, arms relaxed at sides (same as stand)"),
    ("step2", "walking, RIGHT leg lifted forward in mid-step, LEFT leg planted, arms swinging slightly"),
]


def build_prompt(direction_desc: str, frame_desc: str) -> str:
    return (
        f"Same chibi cartoon student character from the reference image. "
        f"Keep IDENTICAL: face, hair style, hair color, skin tone, clothing (blue polo shirt + dark blue shorts + orange backpack + glasses), body proportions, art style. "
        f"Change ONLY the POSE and ORIENTATION: "
        f"The character is {direction_desc}. "
        f"Pose: {frame_desc}. "
        f"Full body visible, head to feet, centered in frame. "
        f"BACKGROUND: ENTIRELY a single flat solid CHROMA-KEY GREEN color "
        f"(#00b140 chroma green) filling every pixel that is not the character. "
        f"NO gradient, NO texture, NO shadow on the background, NO ground, NO scenery. "
        f"Same flat 2D children's storybook illustration style as reference, "
        f"thick clean bold dark outline, soft simple shading, bright cheerful "
        f"saturated colors. NO text NO letters NO numbers NO watermark NO frame."
    )


def _chroma_key_border(png_bytes: bytes, dist: int = 80) -> bytes:
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1],
               px[w // 2, 0], px[w // 2, h - 1], px[0, h // 2], px[w - 1, h // 2]]
    br = sum(c[0] for c in corners) // len(corners)
    bg = sum(c[1] for c in corners) // len(corners)
    bb = sum(c[2] for c in corners) // len(corners)

    def is_bg(r, g, b):
        return abs(r - br) + abs(g - bg) + abs(b - bb) <= dist

    seen = bytearray(w * h)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        r, g, b, a = px[x, y]
        if not is_bg(r, g, b):
            continue
        px[x, y] = (r, g, b, 0)
        dq.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # decontaminate green fringe
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and g > r + 40 and g > b + 40:
                ng = (max(r, b) + g) // 2
                px[x, y] = (r, ng, b, a)
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def gen(client, base_img, prompt) -> bytes | None:
    for attempt in range(3):
        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=[prompt, base_img]
            )
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None):
                    return part.inline_data.data
        except Exception as e:
            print(f"    ⚠ attempt {attempt + 1}: {e}")
            if attempt < 2:
                time.sleep(2)
    return None


def normalize_frame(raw_png: bytes, target_size: int = 128) -> Image.Image:
    """Chroma-key + bbox 裁 + resize 統一格子大小 (target × target)，
    人物腳底齊在格子底部、水平置中。"""
    cleaned = _chroma_key_border(raw_png)
    img = Image.open(io.BytesIO(cleaned)).convert("RGBA")
    bbox = img.getbbox()
    if not bbox:
        return Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    img = img.crop(bbox)
    # scale to fit target_size keeping aspect
    img.thumbnail((target_size, target_size), Image.LANCZOS)
    # paste 到正方形格子，水平置中、底對齊
    grid = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    paste_x = (target_size - img.width) // 2
    paste_y = target_size - img.height  # 腳底貼底
    grid.paste(img, (paste_x, paste_y))
    return grid


def main():
    if not os.environ.get("GEMINI_API_KEY"):
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)
    if not BASE.exists():
        print(f"ERROR: base image not found: {BASE}")
        sys.exit(1)

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    base_img = Image.open(BASE).convert("RGBA")
    print(f"Base: {BASE.name} {base_img.size}")
    print(f"Output dir: {OUT_DIR}")
    print()

    cell = 128
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))

    for row, (dir_key, dir_desc) in enumerate(DIRECTIONS):
        for col, (frame_key, frame_desc) in enumerate(FRAMES):
            name = f"{dir_key}_{frame_key}.png"
            out_path = OUT_DIR / name
            if out_path.exists():
                print(f"  [skip] {name} (exists)")
                frame_img = Image.open(out_path).convert("RGBA")
            else:
                prompt = build_prompt(dir_desc, frame_desc)
                print(f"  [{row+1}-{col+1}/16] {name} … ", end="", flush=True)
                raw = gen(client, base_img, prompt)
                if not raw:
                    print("FAILED")
                    continue
                frame_img = normalize_frame(raw, cell)
                frame_img.save(out_path, "PNG", optimize=True)
                print(f"✓ ({frame_img.size})")
            # paste to sheet
            sheet.paste(frame_img, (col * cell, row * cell), frame_img)

    sheet.save(SHEET, "PNG", optimize=True)
    print()
    print(f"✓ Sprite sheet: {SHEET} ({sheet.size})")


if __name__ == "__main__":
    main()
