"""24 個女角職業 sprite（PVP demo 派派要男女並存）。

i2i：餵既有男角 hero_job_{key}.png 當 ref，生女角版本（同職業造型、chibi 風）。
存到 hero_job_{key}_f.png

3 parallel，~40-60 min。
"""
import argparse
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ARENA_DIR = ROOT / "assets/images/arena"
JOBS_DATA = json.loads((ROOT / "assets/data/jobs.json").read_text())


def build_prompt(job: dict, out_path: Path) -> str:
    return (
        f"請用 image_generation 工具生一張 PNG，要求：\n"
        f"1. 角色：女孩 chibi 版本，跟 ref 圖一樣的{job['name']}職業造型\n"
        f"2. 細節：保留 ref 的職業特徵服裝/配件/道具（{job['description']}），但角色是女性（短髮或馬尾、女性五官、可愛圓臉）\n"
        f"3. 姿勢：3/4 側面朝右，戰鬥架式或職業代表姿勢（跟 ref 一致）\n"
        f"4. 風格：Q 版 chibi RPG 立繪風，2.5 頭身，可愛圓臉，飽和色彩\n"
        f"5. 完全透明背景（NO 平台 NO 陰影 NO 地板 NO 框）\n"
        f"6. 輸出絕對路徑：{out_path}"
    )


def run_one(job: dict, overwrite: bool = False) -> tuple[str, bool, str]:
    key = job["key"]
    male_ref = ARENA_DIR / f"hero_job_{key}.png"
    out_path = ARENA_DIR / f"hero_job_{key}_f.png"
    if not male_ref.exists():
        return (key, False, f"male ref missing: {male_ref}")
    if out_path.exists() and not overwrite:
        return (key, True, f"skip (exists {out_path.stat().st_size//1024}KB)")

    prompt = build_prompt(job, out_path)
    cmd = [
        "codex", "exec", "--sandbox", "workspace-write",
        "-i", str(male_ref),
    ]
    try:
        result = subprocess.run(
            cmd, input=prompt, text=True,
            capture_output=True, timeout=420,
        )
        if out_path.exists():
            try:
                im = Image.open(out_path).convert("RGBA")
                if max(im.size) > 600:
                    im.thumbnail((512, 512), Image.LANCZOS)
                # 女角預設朝右（跟男角一致）
                im.save(out_path, "PNG", optimize=True)
            except Exception as e:
                return (key, True, f"saved but post err: {e}")
            return (key, True, f"OK ({out_path.stat().st_size//1024}KB)")
        tail = (result.stderr or "")[-180:]
        return (key, False, f"no output: {tail}")
    except subprocess.TimeoutExpired:
        return (key, False, "timeout 420s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", action="append", help="限定 job key")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--parallel", type=int, default=3)
    args = ap.parse_args()

    jobs = [j for j in JOBS_DATA if (not args.key or j["key"] in args.key)]
    print(f"=== 跑 {len(jobs)} 張 female job sprite，{args.parallel} parallel ===", flush=True)

    ok, fail = [], []
    with ThreadPoolExecutor(max_workers=args.parallel) as ex:
        futures = {ex.submit(run_one, j, args.overwrite): j["key"] for j in jobs}
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
