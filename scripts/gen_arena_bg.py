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
    "JRPG dungeon battle arena BACKGROUND ONLY (no foreground floor) in the "
    "style of Atelier Marie (Gust 1997 PS1). Top-down 30-degree isometric view "
    "of a tall dark dungeon hall: two stone dungeon walls on the LEFT and RIGHT "
    "sides (vertical walls receding into perspective). Each side wall has two "
    "wall-mounted iron torches with warm orange-yellow flame casting glow onto "
    "the walls. The upper area is dim dungeon depth (a far back stone wall or "
    "shadow). The LOWER HALF of the image should be a DARK, FLAT, UNIFORM, "
    "UNDECORATED dungeon ground (just dark stone/dirt floor with subtle "
    "ambient occlusion shadow from the walls) — NO floor tiles, NO platform, "
    "NO chess grid, NO stone slabs, NO highlights on the floor. The bottom "
    "60% must be a clean empty dark surface so that a chessboard UI overlay "
    "(drawn by CSS) can sit on top. "
    "Painterly anime-game illustration, cozy 90s JRPG vibe, warm torchlight "
    "vs cool stone shadows. "
    "ABSOLUTELY NO characters, NO people, NO monsters, NO creatures, NO heroes, "
    "NO text, NO letters, NO numbers, NO UI, NO HUD, NO frames, NO border, "
    "NO floor pattern, NO tile grid. "
    "Full opaque background filling the whole image, landscape composition. "
    "Center+lower area completely clean, dark, uncluttered."
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
