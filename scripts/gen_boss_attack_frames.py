"""15 隻魔王各生 2 幀（charge + release），i2i 用 idle.png + attack.png 雙 ref。

動畫順序：idle → charge → attack(既有) → release → idle
共 30 張新 PNG，分 5 科 × 3 tier。

Codex CLI image_gen，每張 ~3-5 min，跑 3 parallel。
"""
import argparse
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BOSS_DIR = ROOT / "assets/images/boss/v2"
SUBJECTS = ["math", "chinese", "english", "science", "social"]
TIERS = ["t1", "t2", "t3"]

SUBJECT_NAMES = {
    "math": "math wizard / formula caster",
    "chinese": "Chinese literature / ink calligraphy mage",
    "english": "English alphabet / grammar enforcer",
    "science": "science / element manipulator",
    "social": "geography / globe historian",
}


def build_prompt_charge(subj: str, tier: str, out_path: Path) -> str:
    name = SUBJECT_NAMES[subj]
    return (
        f"請用 image_generation 工具生一張 PNG，要求：\n"
        f"1. 角色：與兩張 ref 完全相同的同一隻 {name} 魔王（{tier} 等級），臉/體型/服裝/道具完全一致\n"
        f"2. 姿勢：『蓄力前搖』— 比第一張 idle 更張力，比第二張 attack 還在準備發動。雙手聚攏在胸前或舉起、身體微微下蹲蓄力、發光氣場匯聚\n"
        f"3. 表情：兇狠專注，眼睛發光\n"
        f"4. 風格：跟兩張 ref 同樣的 chibi RPG 立繪風（2.5 頭身、可愛圓臉），完全透明背景\n"
        f"5. 視角：跟 ref 一樣（同方向、同角度）\n"
        f"6. 不要平台、不要陰影、不要地板、不要框\n"
        f"7. 輸出到絕對路徑：{out_path}"
    )


def build_prompt_release(subj: str, tier: str, out_path: Path) -> str:
    name = SUBJECT_NAMES[subj]
    return (
        f"請用 image_generation 工具生一張 PNG，要求：\n"
        f"1. 角色：與兩張 ref 完全相同的同一隻 {name} 魔王（{tier} 等級），臉/體型/服裝/道具完全一致\n"
        f"2. 姿勢：『出招後跟進』— 比第二張 attack 更後段，剛把絕招放出去、雙手向前完全伸展或揮出，身體前傾、能量殘留尾跡\n"
        f"3. 表情：施放完招式後的爆發感，吼叫或張口\n"
        f"4. 風格：跟兩張 ref 同樣的 chibi RPG 立繪風（2.5 頭身、可愛圓臉），完全透明背景\n"
        f"5. 視角：跟 ref 一樣（同方向、同角度）\n"
        f"6. 不要平台、不要陰影、不要地板、不要框\n"
        f"7. 輸出到絕對路徑：{out_path}"
    )


def run_one(subj: str, tier: str, phase: str, overwrite: bool = False) -> tuple[str, bool, str]:
    tag = f"{subj}/{tier}/{phase}"
    boss_dir = BOSS_DIR / subj / tier
    idle_ref = boss_dir / "idle.png"
    attack_ref = boss_dir / "attack.png"
    out_path = boss_dir / f"{phase}.png"

    if not idle_ref.exists() or not attack_ref.exists():
        return (tag, False, f"refs missing: idle={idle_ref.exists()}, attack={attack_ref.exists()}")
    if out_path.exists() and not overwrite:
        return (tag, True, "skip (exists)")

    if phase == "charge":
        prompt = build_prompt_charge(subj, tier, out_path)
    elif phase == "release":
        prompt = build_prompt_release(subj, tier, out_path)
    else:
        return (tag, False, f"unknown phase: {phase}")

    cmd = [
        "codex", "exec", "--sandbox", "workspace-write",
        "-i", str(idle_ref),
        "-i", str(attack_ref),
    ]
    try:
        result = subprocess.run(
            cmd, input=prompt, text=True,
            capture_output=True, timeout=420,
        )
        if out_path.exists():
            # 對齊 idle 大小（後處理：resize 到 idle 同尺寸）
            try:
                idle_im = Image.open(idle_ref)
                out_im = Image.open(out_path).convert("RGBA")
                if out_im.size != idle_im.size:
                    out_im = out_im.resize(idle_im.size, Image.LANCZOS)
                    out_im.save(out_path, "PNG", optimize=True)
            except Exception as e:
                return (tag, True, f"saved but resize err: {e}")
            return (tag, True, f"OK ({out_path.stat().st_size // 1024}KB)")
        else:
            tail = (result.stderr or "")[-200:]
            return (tag, False, f"no output: {tail}")
    except subprocess.TimeoutExpired:
        return (tag, False, "timeout 420s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subj", action="append", help="限定 subject (math/chinese/english/science/social)")
    ap.add_argument("--tier", action="append", help="限定 tier (t1/t2/t3)")
    ap.add_argument("--phase", action="append", choices=["charge", "release"], help="限定 phase")
    ap.add_argument("--overwrite", action="store_true", help="覆寫既有檔")
    ap.add_argument("--parallel", type=int, default=3, help="同時併發數 (Codex 較吃資源)")
    args = ap.parse_args()

    subjs = args.subj or SUBJECTS
    tiers = args.tier or TIERS
    phases = args.phase or ["charge", "release"]

    jobs = [(s, t, p) for s in subjs for t in tiers for p in phases]
    print(f"=== 跑 {len(jobs)} 張，{args.parallel} parallel ===", flush=True)

    ok, fail = [], []
    with ThreadPoolExecutor(max_workers=args.parallel) as ex:
        futures = {ex.submit(run_one, s, t, p, args.overwrite): (s, t, p) for s, t, p in jobs}
        for fut in as_completed(futures):
            tag, success, msg = fut.result()
            mark = "✓" if success else "✗"
            print(f"  [{mark}] {tag}  {msg}", flush=True)
            (ok if success else fail).append(tag)

    print(f"\n=== Done. OK: {len(ok)} / Fail: {len(fail)} ===", flush=True)
    if fail:
        print(f"Failed: {fail}")


if __name__ == "__main__":
    main()
