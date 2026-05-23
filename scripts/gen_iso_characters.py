"""Repaint hero + boss to Atelier Marie 1997 isometric 30-degree top-down view.

i2i feeds existing sprites as visual reference so character identity is preserved,
prompt asks Gemini to re-render the SAME character from a tilted top-down angle
matching the dungeon arena background's perspective.

Output: transparent PNGs sized for the demo (~400px tall after PIL).
"""
import io
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDUARENA_ENV = Path("/home/gamezpika/eduarena/.env")

from dotenv import load_dotenv
load_dotenv(EDUARENA_ENV)

from google import genai
from google.genai import types
from PIL import Image

MODEL = "gemini-2.5-flash-image"
OUT_DIR = ROOT / "assets" / "images" / "arena"

# 各角色 ref + prompt
JOBS = [
    {
        "key": "hero_iso",
        "ref": OUT_DIR / "hero.png",
        "prompt": (
            "Repaint this exact same character (keep identity: same face, hair, "
            "outfit colors, body proportions) from a 30-degree top-down isometric "
            "view, as if seen from slightly above and behind. The character should "
            "now appear standing on a stone platform with their feet planted, body "
            "facing toward the right (toward an opponent on their right side). "
            "Atelier Marie 1997 PS1 chibi RPG style: 2.5 head-height proportions, "
            "thick clean linework, simple flat anime cell-shading, painterly soft "
            "shading on body, slight rim light from above. The character is standing "
            "in a confident battle pose, slightly leaning forward, ready to fight. "
            "Drop shadow under feet (small dark ellipse). "
            "Fully transparent background (alpha channel cutout, no scenery, no "
            "floor tile, no other characters, no text, no border, no frame). "
            "Single character, full body, centered, vertical portrait composition."
        ),
    },
    {
        "key": "boss_iso",
        "ref": OUT_DIR / "boss_idle.png",
        "prompt": (
            "Repaint this exact same boss monster (keep identity: same body shape, "
            "color, mathematical symbols/accessories, menacing features) from a "
            "30-degree top-down isometric view, as if seen from slightly above and "
            "in front. The boss is now standing on a stone platform with body "
            "facing toward the LEFT (toward a hero on its left side, ready to "
            "engage in battle). Atelier Marie 1997 PS1 chibi RPG style: cute but "
            "intimidating chibi proportions, thick clean linework, simple flat "
            "anime cell-shading, painterly soft shading, slight rim light from "
            "above. The boss is in a battle-ready pose, looking down menacingly "
            "at its opponent. Drop shadow under it. "
            "Fully transparent background (alpha channel cutout, no scenery, no "
            "floor tile, no other characters, no text, no border, no frame). "
            "Single boss creature, full body, centered."
        ),
    },
]


def gen_one(client, job):
    print(f"-> {job['key']}: loading ref {job['ref'].name} ...")
    ref_img = Image.open(job["ref"])
    print(f"   ref size: {ref_img.size}, mode: {ref_img.mode}")
    print(f"-> calling Gemini ...")
    resp = client.models.generate_content(
        model=MODEL,
        contents=[
            job["prompt"],
            ref_img,
        ],
    )
    saved = False
    for part in resp.candidates[0].content.parts:
        if part.inline_data and part.inline_data.data:
            img = Image.open(io.BytesIO(part.inline_data.data))
            out_path = OUT_DIR / f"{job['key']}.png"
            img.save(out_path, "PNG", optimize=True)
            print(f"   saved: {out_path.name}  ({out_path.stat().st_size // 1024}KB, {img.size}, {img.mode})")
            saved = True
            break
    if not saved:
        print(f"   !! NO image data in response for {job['key']}")
        print(f"   response: {resp}")
        return False
    return True


def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)
    client = genai.Client(api_key=api_key)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = sys.argv[1:] if len(sys.argv) > 1 else [j["key"] for j in JOBS]
    for job in JOBS:
        if job["key"] in targets:
            ok = gen_one(client, job)
            if not ok:
                print(f"!! failed: {job['key']}")
    print("Done.")


if __name__ == "__main__":
    main()
