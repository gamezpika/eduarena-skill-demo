"""Batch 跑 codex exec 生 23 個職業專屬主角 sprite（math_detective 已有）。

每個職業：餵 2 張 ref（EduArena 既有職業 sprite + boy_base hero.png），
codex 用 image_generation 工具生「主角身份 + 該職業造型 + 30° 等距戰鬥架式」。

後處理：PIL resize 1254→512 + flip（派派 5/23 選 B 方向）。
"""
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EDU_JOBS = Path("/home/gamezpika/eduarena/assets/images/jobs")
HERO_REF = ROOT / "assets/images/arena/hero.png"
OUT_DIR = ROOT / "assets/images/arena"

JOBS_DATA = json.loads((ROOT / "assets/data/jobs.json").read_text())


def build_prompt(job, out_path):
    return (
        f"請用 image_generation 工具生一張 PNG 角色 sprite，要求：\n"
        f"1. 角色身份：跟第二張 ref（chibi 男孩 boy_base）的臉/髮型/體型一樣\n"
        f"2. 職業造型：穿戴第一張 ref（{job['name']}）的特徵，包含該職業的代表服裝、配件、道具。{job['description']}\n"
        f"3. 視角：3/4 側面朝右，戰鬥架式或職業代表姿勢\n"
        f"4. 風格：Q 版 chibi RPG 立繪風，2.5 頭身比例，可愛圓臉\n"
        f"5. 完全透明背景（無平台、無陰影、無地板、無框）\n"
        f"6. 輸出到絕對路徑：{out_path}"
    )


def run_codex(job):
    ref_job = EDU_JOBS / Path(job["sprite"]).name
    if not ref_job.exists():
        print(f"!! ref missing: {ref_job}")
        return False
    out_path = OUT_DIR / f"hero_job_{job['key']}.png"
    if out_path.exists():
        print(f"-> skip {job['key']} (already exists)")
        return True
    prompt = build_prompt(job, out_path)
    cmd = [
        "codex", "exec", "--sandbox", "workspace-write",
        "-i", str(ref_job),
        "-i", str(HERO_REF),
    ]
    print(f"-> {job['key']} ({job['name']}) ...", flush=True)
    try:
        result = subprocess.run(
            cmd, input=prompt, text=True,
            capture_output=True, timeout=300,
        )
        if out_path.exists():
            print(f"   ✓ saved ({out_path.stat().st_size // 1024}KB)")
            return True
        else:
            print(f"   ✗ no output. stderr: {result.stderr[-300:] if result.stderr else 'none'}")
            return False
    except subprocess.TimeoutExpired:
        print(f"   ✗ timeout 300s")
        return False


def post_process(key):
    """resize 512 + flip（派派 5/23 修正：codex 直出面向左，需 flip 朝右才對魔王）"""
    p = OUT_DIR / f"hero_job_{key}.png"
    if not p.exists():
        return False
    img = Image.open(p)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    if max(img.size) > 600:
        img.thumbnail((512, 512), Image.LANCZOS)
    img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img.save(p, "PNG", optimize=True)
    return True


def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else [j["key"] for j in JOBS_DATA]
    ok, fail = [], []
    for job in JOBS_DATA:
        if job["key"] not in targets:
            continue
        if run_codex(job):
            if post_process(job["key"]):
                ok.append(job["key"])
            else:
                fail.append(job["key"])
        else:
            fail.append(job["key"])
    print(f"\n=== Done. OK: {len(ok)} / Fail: {len(fail)} ===")
    if fail:
        print(f"Failed: {fail}")


if __name__ == "__main__":
    main()
