"""把 world_map_config.json 內 12 個 building 的 bbox → polygon 4 點矩形。

向後相容：保留 bbox 欄位，但新加 polygon (4 點矩形)，編輯器跟 chibi 邏輯改讀 polygon。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "assets" / "world_map_config.json"


def bbox_to_polygon(bb):
    """bbox → 4 點矩形 polygon（順時針從左上）"""
    return [
        {"x": bb["x_min"], "y": bb["y_min"]},
        {"x": bb["x_max"], "y": bb["y_min"]},
        {"x": bb["x_max"], "y": bb["y_max"]},
        {"x": bb["x_min"], "y": bb["y_max"]},
    ]


def main():
    with open(CONFIG) as f:
        data = json.load(f)

    cnt = 0
    for b in data["map_config"]["buildings"]:
        if "polygon" not in b:
            b["polygon"] = bbox_to_polygon(b["bounding_box"])
            cnt += 1

    with open(CONFIG, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✓ migrated {cnt} buildings to polygon")


if __name__ == "__main__":
    main()
