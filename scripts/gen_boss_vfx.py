"""15 隻魔王各生 1 張楓之谷風招式 VFX 圖（透明 PNG）。

每張 = 該招式的「特效視覺中心」，由 CSS 動畫接手 motion (drop/sweep/burst/...)。

Codex CLI image_gen，純 text-to-image（不餵 ref），3 parallel。
"""
import argparse
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BOSS_DIR = ROOT / "assets/images/boss/v2"

# 15 個 attack VFX 規格
VFX_SPECS = {
    "math-t1":    ("math/t1",    "math projectile burst: scattered sin/cos/π/√ math symbols glowing cyan and white, anime sparkle bursts, energy particles, MapleStory game skill VFX style"),
    "math-t2":    ("math/t2",    "geometric burst: triangles squares circles in radiant blue cyan, expanding explosion with magic runic circle behind, anime VFX MapleStory style"),
    "math-t3":    ("math/t3",    "huge glowing PI π symbol vortex spiral with deep dark blue energy, magic circle and stars, dramatic anime ultimate skill MapleStory style"),
    "chinese-t1": ("chinese/t1", "Chinese ink calligraphy brush sweep stroke arc, deep red and gold ink splash, paper texture flying, anime VFX MapleStory style"),
    "chinese-t2": ("chinese/t2", "Chinese poetic characters 詩 賦 詞 calligraphy flying with crimson ink trails, scrolls unfurling, MapleStory anime skill VFX"),
    "chinese-t3": ("chinese/t3", "cascading ancient Chinese books and scrolls falling, crimson ink storm splash, MapleStory ultimate skill VFX dramatic"),
    "english-t1": ("english/t1", "alphabet letter projectiles ABC scattered glowing purple violet, sparkle stars, MapleStory anime skill VFX"),
    "english-t2": ("english/t2", "magic runic spell circle with floating alphabet letters S P E L L glowing purple, rotating sigil MapleStory anime skill VFX"),
    "english-t3": ("english/t3", "massive purple laser beam horizontal blast with alphabet letter fragments flying, intense glow, MapleStory ultimate skill VFX"),
    "science-t1": ("science/t1", "tri-element burst: small fire ember + ice crystal shard + lightning bolt clustered, green and white sparks, MapleStory anime skill VFX"),
    "science-t2": ("science/t2", "lightning chain bolt zigzag jagged thunder, white core green outer glow with sparks, MapleStory skill VFX"),
    "science-t3": ("science/t3", "tri-elemental storm explosion: fire ice and thunder simultaneously bursting outward in spiral, dramatic, MapleStory ultimate skill VFX"),
    "social-t1":  ("social/t1",  "ancient map-textured spear with golden runes glowing, leather scroll wrap, sparkles trailing, MapleStory anime skill VFX"),
    "social-t2":  ("social/t2",  "huge clock face dial spinning with arrows and roman numerals, gold and bronze, time vortex effect, MapleStory anime skill VFX"),
    "social-t3":  ("social/t3",  "massive continental landmass slab with mountain ranges textured, golden shockwave aura around, MapleStory ultimate skill VFX falling"),
}


def build_prompt(spec: str, out_path: Path) -> str:
    return (
        f"請用 image_generation 工具生一張 1024x1024 透明背景 PNG，要求：\n"
        f"1. 主題：{spec}\n"
        f"2. 風格：anime 遊戲 VFX 特效圖、楓之谷 MapleStory 招式風、飽和色彩、強烈光暈、外發光\n"
        f"3. 完全透明背景（NO background, NO frame, NO border）\n"
        f"4. 特效置中、不被邊緣裁切、佔畫面 70-90%\n"
        f"5. 不包含人物、不包含場景、只有純特效視覺\n"
        f"6. 輸出到絕對路徑：{out_path}"
    )


def run_one(key: str, overwrite: bool = False) -> tuple[str, bool, str]:
    rel, spec = VFX_SPECS[key]
    out_path = BOSS_DIR / rel / "vfx.png"
    if out_path.exists() and not overwrite:
        return (key, True, f"skip (exists {out_path.stat().st_size // 1024}KB)")

    prompt = build_prompt(spec, out_path)
    cmd = ["codex", "exec", "--sandbox", "workspace-write"]
    try:
        result = subprocess.run(
            cmd, input=prompt, text=True,
            capture_output=True, timeout=420,
        )
        if out_path.exists():
            # resize to 512 (smaller stage element)
            try:
                im = Image.open(out_path).convert("RGBA")
                if max(im.size) > 600:
                    im.thumbnail((512, 512), Image.LANCZOS)
                    im.save(out_path, "PNG", optimize=True)
            except Exception as e:
                return (key, True, f"saved but resize err: {e}")
            return (key, True, f"OK ({out_path.stat().st_size // 1024}KB)")
        tail = (result.stderr or "")[-180:]
        return (key, False, f"no output: {tail}")
    except subprocess.TimeoutExpired:
        return (key, False, "timeout 420s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", action="append", help="限定 attack key (e.g. math-t3)")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--parallel", type=int, default=3)
    args = ap.parse_args()

    keys = args.key or list(VFX_SPECS.keys())
    print(f"=== 跑 {len(keys)} 張 VFX，{args.parallel} parallel ===", flush=True)

    ok, fail = [], []
    with ThreadPoolExecutor(max_workers=args.parallel) as ex:
        futures = {ex.submit(run_one, k, args.overwrite): k for k in keys}
        for fut in as_completed(futures):
            k, success, msg = fut.result()
            mark = "✓" if success else "✗"
            print(f"  [{mark}] {k}  {msg}", flush=True)
            (ok if success else fail).append(k)
    print(f"\n=== Done. OK: {len(ok)} / Fail: {len(fail)} ===", flush=True)
    if fail:
        print(f"Failed: {fail}")


if __name__ == "__main__":
    main()
