"""Generate dungeon background (NO floor tiles —棋盤交給 CSS 自己畫).

派派要求棋盤格實質作用 + 視覺反饋移動步數 → 底圖不能再包石板平台，
要讓 CSS 棋盤 div 浮在純地牢地面上。
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDUARENA_ENV = Path("/home/gamezpika/eduarena/.env")

from dotenv import load_dotenv
load_dotenv(EDUARENA_ENV)

from google import genai
from PIL import Image
import io

MODEL = "gemini-2.5-flash-image"
OUT = ROOT / "assets" / "images" / "arena" / "dungeon_bg.png"

PROMPT = (
    "JRPG dungeon room background, Atelier Marie 1997 PS1 style. "
    "Top-down 30-degree isometric perspective looking down into a deep dark "
    "dungeon hall. Two stone walls on LEFT and RIGHT sides receding into the "
    "back, each with two wall-mounted iron torches (warm orange flame). "
    "Far back wall in shadow. "
    "THE FLOOR fills the ENTIRE bottom HALF of the image edge to edge, "
    "uniformly dark stone surface, COMPLETELY FLAT and UNIFORM — same dark "
    "color from left edge to right edge to bottom edge, NO central platform, "
    "NO diamond shape on the floor, NO highlighted center area, NO contrast "
    "between center and edges, NO tile pattern, NO grid lines. "
    "Imagine a vast empty dungeon floor that extends to all four corners of "
    "the image — uniform dark dirty stone with subtle ambient shadow from the "
    "walls but no distinct floor pattern. "
    "Painterly anime-game illustration, cozy 90s JRPG vibe, warm torchlight "
    "creating glow on walls only (not on floor center). "
    "ABSOLUTELY NO characters, NO monsters, NO text, NO UI, NO frames, "
    "NO tiles, NO platform, NO diamond, NO floor highlight."
)


def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found")
        sys.exit(1)
    client = genai.Client(api_key=api_key)
    print("Calling Gemini", MODEL, "...")
    resp = client.models.generate_content(
        model=MODEL,
        contents=PROMPT,
    )
    for part in resp.candidates[0].content.parts:
        if part.inline_data and part.inline_data.data:
            img = Image.open(io.BytesIO(part.inline_data.data))
            OUT.parent.mkdir(parents=True, exist_ok=True)
            img.save(OUT, "PNG", optimize=True)
            print(f"Saved: {OUT}  ({OUT.stat().st_size // 1024}KB, {img.size})")
            return
    print("ERROR: no image data in response")
    sys.exit(1)


if __name__ == "__main__":
    main()
