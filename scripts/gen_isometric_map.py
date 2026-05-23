"""生 isometric 菱形網格 EduArena 學園村大圖（A 案先看畫風）。

Gemini 2.5-flash-image 直向 9:16，含 12 棟對應 EduArena 模組的建築 + 明顯菱形網格。
"""
import io
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv("/home/gamezpika/eduarena/.env")

from google import genai
from PIL import Image

MODEL = "gemini-2.5-flash-image"
OUT = ROOT / "assets" / "images" / "world_map_iso.png"

PROMPT = (
    "Isometric 2.5D top-down bird's-eye view of a chibi cartoon fantasy school village. "
    "VERY IMPORTANT: Clearly visible DIAMOND/RHOMBUS GRID tiles drawn on the bright green "
    "grass ground - each tile is the same size, forming a regular grid pattern, with subtle "
    "lighter green borders between tiles. Each major building sits centered on its own "
    "diamond tile. Stone-paved walkways/paths connect buildings along grid lines. "
    ""
    "Place these 12 buildings in a roughly 3-column × 4-row arrangement (each on its own "
    "diamond tile, well-spaced apart so each is visually distinct): "
    "Row 1 (top): "
    " (1) Chinese red-blue pagoda island with cherry blossoms (top-left), "
    " (2) Tall purple crystal dark tower (top-center), "
    " (3) Blue-roofed European fairytale castle with red turrets (top-right). "
    "Row 2 (upper-middle): "
    " (4) Red-brick wooden general store with striped awning (left), "
    " (5) White Greek marble temple with columns and blue roof (center, the exam center), "
    " (6) Blue-domed white pavilion with marble statues (right, the museum). "
    "Row 3 (lower-middle): "
    " (7) Circular Roman colosseum arena with red banners (left, PvP arena), "
    " (8) Golden wheat field with wooden fence and small barn (center, farm), "
    " (9) Wooden bulletin board with hanging scrolls (right, quest board). "
    "Row 4 (bottom): "
    " (10) Sandy pyramid with mathematical abacus and obelisk (left, math island), "
    " (11) Giant golden globe under stone archway (center, social island), "
    " (12) Rocky mountain with brass telescope on platform (right, science island). "
    ""
    "Style: chibi kawaii cute illustration, soft pastel cheerful colors, hand-painted "
    "children's storybook quality, thick clean dark outlines, simple soft shading. "
    "Trees and flowers scattered between tiles but not blocking grid lines. "
    "ABSOLUTELY NO characters NO people NO animals NO text NO letters NO numbers NO "
    "watermark NO logos NO UI. "
    "Composition: TALL PORTRAIT 9:16 aspect ratio (taller than wide). Bright sunny day."
)


def gen(client):
    import time
    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=PROMPT)
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None):
                    return part.inline_data.data
        except Exception as e:
            print(f"  attempt {attempt+1}: {e}")
            if attempt < 2:
                time.sleep(2)
    return None


def main():
    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("ERROR: GEMINI_API_KEY not set")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    print("生 isometric EduArena 學園村大圖中…")
    raw = gen(client)
    if not raw:
        sys.exit("✗ 生圖失敗")
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((1280, 1820), Image.LANCZOS)
    img.save(OUT, "PNG", optimize=True)
    print(f"✓ {OUT.name} 尺寸={img.size}  {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
