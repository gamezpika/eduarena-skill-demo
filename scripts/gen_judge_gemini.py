"""Gemini i2i fallback 補生 judge sprite（Codex timeout 過）。"""
import io, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDU_JOBS = Path("/home/gamezpika/eduarena/assets/images/jobs")
HERO_REF = ROOT / "assets/images/arena/hero.png"
OUT = ROOT / "assets/images/arena/hero_job_judge.png"

from dotenv import load_dotenv
load_dotenv(Path("/home/gamezpika/eduarena/.env"))

from google import genai
from PIL import Image
from rembg import remove

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("Calling Gemini ...")
resp = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[
        "Repaint this exact same young boy chibi character (face/hair/body from "
        "the second ref) wearing the JUDGE outfit from the first ref: black judge "
        "robe with white collar, holding a wooden gavel in one hand, scales of "
        "justice nearby. Atelier Marie 1997 PS1 chibi RPG style, 2.5 head-height "
        "proportions, 3/4 side-view, battle-ready stance. PURE TRANSPARENT "
        "BACKGROUND, NO platform, NO floor, NO shadow. Full body centered.",
        Image.open(EDU_JOBS / "judge.png"),
        Image.open(HERO_REF),
    ],
)
for part in resp.candidates[0].content.parts:
    if part.inline_data and part.inline_data.data:
        img = Image.open(io.BytesIO(part.inline_data.data))
        print(f"raw: {img.size} {img.mode}")
        # rembg + resize + flip
        img = remove(img)
        if max(img.size) > 600:
            img.thumbnail((512, 512), Image.LANCZOS)
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        img.save(OUT, "PNG", optimize=True)
        print(f"Saved {OUT} ({OUT.stat().st_size//1024}KB, {img.size}, {img.mode})")
        sys.exit(0)
print("ERROR no image"); sys.exit(1)
