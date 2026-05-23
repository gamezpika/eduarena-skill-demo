"""升級 subjects.json：加 tier 結構（t1/t2/t3）對應 15 隻 EduArena v2 boss。"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "assets" / "data" / "subjects.json"
old = json.loads(DATA.read_text(encoding="utf-8"))

SUBJECT_DISPLAY = {
    "math":    ("📐", "數學"),
    "chinese": ("📕", "國語"),
    "english": ("🔤", "英文"),
    "science": ("🔬", "自然"),
    "social":  ("🌏", "社會"),
}

TIER_DEF = [
    ("t1", "T1 初級", 200, "初級魔王"),
    ("t2", "T2 中級", 300, "中級魔王"),
    ("t3", "T3 終極", 400, "終極魔王"),
]

new = {}
for skey, data in old.items():
    emoji, label = SUBJECT_DISPLAY.get(skey, ("📚", skey))
    tiers = {}
    for tkey, tlabel, hp, suffix in TIER_DEF:
        base = f"boss/v2/{skey}/{tkey}"
        tiers[tkey] = {
            "name": f"{label}{suffix}",
            "label": tlabel,
            "sprite": f"{base}/idle.png",
            "hit_sprite": f"{base}/hit.png",
            "attack_sprite": f"{base}/attack.png",
            "defeat_sprite": f"{base}/death.png",
            "bg": f"{base}/bg.png",
            "hp": hp,
        }
    new[skey] = {
        "label": label,
        "emoji": emoji,
        "tiers": tiers,
        "questions": data["questions"],
    }

DATA.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Upgraded {DATA}")
print("Sample math.t3:", json.dumps(new["math"]["tiers"]["t3"], ensure_ascii=False))
