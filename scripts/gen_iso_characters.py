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
            "outfit colors, body proportions) from a 3/4 SIDE-VIEW with 30-degree "
            "top-down tilt — the character must be CLEARLY TURNED TO THE RIGHT "
            "with body facing RIGHT (their right shoulder pointing toward the "
            "viewer slightly, side profile visible, head turned to look right at "
            "an opponent on the right side). Like a JRPG side-view battler in "
            "Atelier Marie 1997 PS1 style: 2.5 head-height chibi proportions, "
            "thick clean linework, simple flat anime cell-shading. The character "
            "is in a battle-ready stance, leaning slightly forward toward the "
            "right, weapon or fists ready. "
            "ABSOLUTELY NO platform, NO pedestal, NO base, NO stone tile, NO "
            "podium, NO floor of any kind under the feet. The feet should be "
            "directly on transparent background. NO shadow, NO ground. "
            "PURE TRANSPARENT BACKGROUND ONLY (alpha channel cutout) — completely "
            "empty around the character except the character itself. "
            "NO scenery, NO other characters, NO text, NO border, NO frame. "
            "Single character, full body from head to feet, centered vertically, "
            "tight composition with no extra space."
        ),
    },
    {
        "key": "boss_iso",
        "ref": OUT_DIR / "boss_idle.png",
        "prompt": (
            "Repaint this exact same boss monster (keep identity: same body shape, "
            "color, mathematical symbols/accessories, menacing features) from a "
            "3/4 SIDE-VIEW with 30-degree top-down tilt — the boss must be CLEARLY "
            "TURNED TO THE LEFT with body facing LEFT (their left shoulder pointing "
            "toward the viewer slightly, side profile visible, head turned to look "
            "left at a hero on the left side). Like a JRPG side-view battler in "
            "Atelier Marie 1997 PS1 style: cute but intimidating chibi proportions, "
            "thick clean linework, simple flat anime cell-shading. The boss is in "
            "a battle-ready stance, leaning slightly toward the left, looking down "
            "menacingly at its opponent. "
            "ABSOLUTELY NO platform, NO pedestal, NO base, NO stone tile, NO "
            "podium, NO floor of any kind under the feet/body. NO shadow, NO ground. "
            "PURE TRANSPARENT BACKGROUND ONLY (alpha channel cutout) — completely "
            "empty around the boss except the boss itself. "
            "NO scenery, NO other characters, NO text, NO border, NO frame. "
            "Single boss creature, full body, centered, tight composition."
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
