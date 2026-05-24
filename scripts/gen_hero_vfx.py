"""24 個職業專屬 VFX 圖（楓之谷風，透明 PNG），主角答對攻擊時顯示。

Codex CLI image_gen，純 text-to-image，3 parallel。
"""
import argparse
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets/images/hero_vfx"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 24 個職業專屬 VFX 主題（楓之谷遊戲招式風）
JOB_VFX = {
    "math_detective":  "magnifying glass shattering with floating math symbols sin cos π √, bright blue energy burst, anime VFX MapleStory style",
    "translator":      "multilingual letters ABC あ 中 ñ flying in tornado swirl, rainbow gradient glow, anime VFX MapleStory skill",
    "inventor":        "exploding gears wrenches and electric sparks, orange yellow energy burst, anime VFX MapleStory skill",
    "explorer":        "ancient compass shattering with map fragments and treasure golden sparkles, anime VFX MapleStory skill",
    "flight_attendant":"airplane silhouette streaking with cloud puffs and sky blue wind trail, anime VFX MapleStory skill",
    "doctor":          "white medical cross radiating green healing glow with plus symbols swirling, anime VFX MapleStory skill",
    "engineer":        "steel hammer impact with gear sparks and orange industrial flame burst, anime VFX MapleStory skill",
    "athlete":         "speed lines burst with running track ring and yellow energy shockwave, anime VFX MapleStory skill",
    "artist":          "colorful paint splash explosion with rainbow brush strokes and palette glow, anime VFX MapleStory skill",
    "ai_engineer":     "electric circuit board pattern with green binary 01 code waterfall and neon glow, anime VFX MapleStory skill",
    "astronaut":       "rocket exhaust explosion with starfield burst and white blue cosmic energy, anime VFX MapleStory skill",
    "president":       "flag radiating golden light with laurel wreath and presidential seal star burst, anime VFX MapleStory skill",
    "poet":            "scroll unfurling with calligraphy poem characters and feather pen light trail, anime VFX MapleStory skill",
    "biologist":       "microscope lens burst with green DNA double helix spiraling and cell particles, anime VFX MapleStory skill",
    "archaeologist":   "ancient runes glowing on cracked stone tablet with desert sand burst, anime VFX MapleStory skill",
    "lawyer":          "wooden gavel striking with justice scales and white judicial light rays, anime VFX MapleStory skill",
    "chef":            "spinning kitchen knife with food particles tomato onion star burst, anime VFX MapleStory skill",
    "reporter":        "microphone sound wave rings with newspaper pages flying and breaking news glow, anime VFX MapleStory skill",
    "programmer":      "matrix style green binary code waterfall with curly braces and hacker terminal glow, anime VFX MapleStory skill",
    "police":          "police badge star burst with red blue siren light pulse, anime VFX MapleStory skill",
    "nobel_laureate":  "chemistry flask exploding with golden Nobel medal and academic laurel burst, anime VFX MapleStory skill",
    "judge":           "wooden judge gavel slam with golden justice scales and white righteous light beam, anime VFX MapleStory skill",
    "space_captain":   "purple laser beam blast with star field captain emblem and sci-fi energy burst, anime VFX MapleStory skill",
    "michelin_chef":   "gourmet plate burst with golden Michelin star and fine dining sparkles, anime VFX MapleStory skill",
}


def build_prompt(job_key: str, spec: str, out_path: Path) -> str:
    return (
        f"請用 image_generation 工具生一張 1024x1024 透明背景 PNG，要求：\n"
        f"1. 主題：{spec}\n"
        f"2. 風格：anime 遊戲 VFX 特效圖、楓之谷 MapleStory 招式風、飽和色彩、強烈光暈\n"
        f"3. 完全透明背景（NO background, NO frame, NO border）\n"
        f"4. 特效置中、佔畫面 70-90%\n"
        f"5. 不包含人物、不包含場景、只有純特效視覺\n"
        f"6. 輸出到絕對路徑：{out_path}"
    )


def run_one(job_key: str, overwrite: bool = False) -> tuple[str, bool, str]:
    spec = JOB_VFX[job_key]
    out_path = OUT_DIR / f"{job_key}.png"
    if out_path.exists() and not overwrite:
        return (job_key, True, f"skip (exists {out_path.stat().st_size//1024}KB)")

    prompt = build_prompt(job_key, spec, out_path)
    cmd = ["codex", "exec", "--sandbox", "workspace-write"]
    try:
        result = subprocess.run(
            cmd, input=prompt, text=True,
            capture_output=True, timeout=420,
        )
        if out_path.exists():
            try:
                im = Image.open(out_path).convert("RGBA")
                if max(im.size) > 600:
                    im.thumbnail((384, 384), Image.LANCZOS)
                    im.save(out_path, "PNG", optimize=True)
                # 同時存 WebP 版（快 ~70%）
                webp = out_path.with_suffix(".webp")
                im2 = Image.open(out_path).convert("RGBA")
                im2.save(webp, "WEBP", quality=80, method=6)
            except Exception as e:
                return (job_key, True, f"saved but post err: {e}")
            return (job_key, True, f"OK ({out_path.stat().st_size//1024}KB png / {webp.stat().st_size//1024}KB webp)")
        tail = (result.stderr or "")[-180:]
        return (job_key, False, f"no output: {tail}")
    except subprocess.TimeoutExpired:
        return (job_key, False, "timeout 420s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", action="append", help="限定 job key")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--parallel", type=int, default=3)
    args = ap.parse_args()

    keys = args.key or list(JOB_VFX.keys())
    print(f"=== 跑 {len(keys)} 張 hero VFX，{args.parallel} parallel ===", flush=True)

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
