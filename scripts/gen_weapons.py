"""Gemini i2i 生 5 種武器版本主角，餵 hero.png 當 ref 維持身份一致。

每個 variant 共同要點：
- 保留同一個角色 (face, hair, T-shirt, shorts, sneakers)
- 30° top-down 3/4 side view（朝右）
- 戰鬥架式
- 透明背景（後續用 rembg 強化去背）
- NO platform / NO floor / NO base

每張武器後續用 hero_iso_{key}.png 命名，跑 rembg 同個流程。
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
from PIL import Image

MODEL = "gemini-2.5-flash-image"
OUT_DIR = ROOT / "assets" / "images" / "arena"
REF = OUT_DIR / "hero.png"

BASE_PROMPT = (
    "Repaint this exact same character (keep identity: same young boy chibi face, "
    "spiky brown hair, white T-shirt, beige shorts, white sneakers) from a 3/4 "
    "SIDE-VIEW with 30-degree top-down tilt — the character must be CLEARLY "
    "TURNED TO THE RIGHT with body facing RIGHT, head turned to look right at "
    "an opponent on the right side. JRPG side-view battler in Atelier Marie "
    "1997 PS1 style: 2.5 head-height chibi proportions, thick clean linework, "
    "simple flat anime cell-shading. Battle-ready stance, leaning slightly "
    "forward toward the right, "
    "{weapon_clause}. "
    "ABSOLUTELY NO platform, NO pedestal, NO base, NO stone tile, NO floor, "
    "NO shadow, NO ground under the feet. "
    "PURE TRANSPARENT BACKGROUND ONLY (alpha channel cutout). "
    "NO scenery, NO other characters, NO text, NO border, NO frame. "
    "Single character, full body from head to feet, centered vertically."
)

WEAPONS = [
    {
        "key": "sword",
        "clause": "holding a SHINY SHORT SWORD with steel blade in their right hand, "
                  "blade pointing upward and slightly forward, ready to swing. "
                  "The sword has a simple silver crossguard and brown leather grip",
    },
    {
        "key": "book",
        "clause": "holding a THICK MAGIC TOMB / large hardcover BOOK in their right hand "
                  "(brown leather cover with gold trim and a glowing rune symbol on the cover), "
                  "raised up like a weapon ready to slam down or open. "
                  "Faint magical glow around the book",
    },
    {
        "key": "pencil",
        "clause": "holding a GIANT YELLOW PENCIL (about the same height as the boy) in "
                  "their right hand like a spear or sword. The pencil has a sharpened "
                  "graphite tip pointing forward and a pink eraser at the back end. "
                  "Wooden yellow shaft with the classic hexagonal pencil shape",
    },
    {
        "key": "staff",
        "clause": "holding a WIZARD'S MAGIC STAFF in their right hand. The staff is a "
                  "wooden brown rod with a glowing CYAN crystal orb mounted at the top, "
                  "emitting soft cyan magical glow / sparkles. Staff is about the boy's "
                  "height. Standing in casting pose",
    },
    {
        "key": "gauntlet",
        "clause": "wearing a LARGE METAL POWER GAUNTLET on their right hand (silver and "
                  "blue armor plating, knuckle spikes, glowing blue gem on the back of "
                  "the hand). Fist clenched and raised in fighting boxing pose, like a "
                  "metal-armored fist ready to punch",
    },
]


def gen_one(client, weapon):
    out_path = OUT_DIR / f"hero_iso_{weapon['key']}.png"
    prompt = BASE_PROMPT.format(weapon_clause=weapon["clause"])
    print(f"-> {weapon['key']}: calling Gemini ...")
    ref_img = Image.open(REF)
    resp = client.models.generate_content(
        model=MODEL,
        contents=[prompt, ref_img],
    )
    for part in resp.candidates[0].content.parts:
        if part.inline_data and part.inline_data.data:
            img = Image.open(io.BytesIO(part.inline_data.data))
            img.save(out_path, "PNG", optimize=True)
            print(f"   saved: {out_path.name} ({out_path.stat().st_size // 1024}KB, {img.size})")
            return True
    print(f"   !! no image for {weapon['key']}")
    return False


def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)
    client = genai.Client(api_key=api_key)
    targets = sys.argv[1:] if len(sys.argv) > 1 else [w["key"] for w in WEAPONS]
    for w in WEAPONS:
        if w["key"] in targets:
            gen_one(client, w)
    print("Done.")


if __name__ == "__main__":
    main()
