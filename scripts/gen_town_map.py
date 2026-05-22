"""生 1 張俯瞰式 chibi 小村莊地圖 PNG (給 walk-demo.html 用)。

風格：top-down 俯瞰，手繪 storybook 風，無人物。
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
OUT = ROOT / "assets" / "images" / "sprites" / "town_map.png"
OUT.parent.mkdir(parents=True, exist_ok=True)

PROMPT = (
    "PURELY top-down bird's eye view (camera looking straight down at 90 degrees), "
    "of a peaceful chibi cartoon village scene. NO perspective, NO isometric. "
    "Composition: large green grass field as base, light brown dirt path winding "
    "through it in an organic curving shape connecting different spots. "
    "Place around the map: "
    "- 3 small cute wooden cottages with red tiled roofs (in different corners) "
    "- 5-6 fluffy round trees (mix of dark green oak and pink cherry blossom) "
    "- 1 round blue pond with lily pads (one side) "
    "- scattered flower patches (red, yellow, pink) "
    "- some small bushes and rocks. "
    "Hand-painted children's storybook illustration style, soft pastel cheerful colors, "
    "clean thick dark outline on objects, simple soft shading. "
    "ABSOLUTELY NO characters, NO people, NO animals, NO text NO letters NO numbers, "
    "NO frame NO border. The paths must be empty for a character sprite to walk on later. "
    "Tall portrait composition (taller than wide, 9:16 aspect ratio). "
    "Whimsical kawaii village setting suitable for primary school children RPG."
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
    print("生地圖中…")
    raw = gen(client)
    if not raw:
        sys.exit("✗ 生圖失敗")
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    # resize 控制大小 (max 1280 邊)
    img.thumbnail((1280, 1280), Image.LANCZOS)
    img.save(OUT, "PNG", optimize=True)
    print(f"✓ {OUT} 尺寸={img.size}")


if __name__ == "__main__":
    main()
