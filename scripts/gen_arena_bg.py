"""Generate isometric dungeon arena background for boss-arena.html demo.

Style reference: Atelier Marie (Gust 1997) PS1 battle scene — isometric stone
tile floor, dungeon side walls with wall-mounted torches, dark atmospheric
lighting. NO characters/text/UI (hero + boss sprites are overlaid by HTML).
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
    "JRPG isometric battle arena scene in the style of Atelier Marie (Gust 1997 PS1). "
    "Top-down 30-degree isometric perspective view of a stone-paved fighting platform "
    "in the center of a dark dungeon hall. The stone floor is composed of clearly "
    "visible square tiles (about 4 by 5 tiles, gridded with subtle dark joints, "
    "weathered grey stone with small grass tufts in cracks). The platform sits on "
    "darker dungeon ground extending outward. Two stone dungeon walls flank the left "
    "and right sides with two lit wall-mounted iron torches (orange-yellow flame, "
    "warm glow casting onto walls). The upper background is dimmer dungeon depth. "
    "Painterly anime-game illustration, cozy 90s JRPG vibe, warm torchlight versus "
    "cool stone shadows, soft ambient occlusion. "
    "ABSOLUTELY NO characters, NO people, NO monsters, NO creatures, NO slimes, "
    "NO heroes, NO text, NO letters, NO numbers, NO UI, NO HUD, NO frames, NO border. "
    "Full opaque background filling the whole image, landscape composition 16:9-ish, "
    "leave the center stone platform clearly visible and uncluttered "
    "(characters will be overlaid on top by the game UI)."
)

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found in", EDUARENA_ENV)
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
    print(resp)
    sys.exit(1)

if __name__ == "__main__":
    main()
