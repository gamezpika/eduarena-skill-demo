"""自動生 12 棟菱形 polygon 寫進 world_map_config.json。

依 isometric 3 列 × 4 行 grid 估算 12 棟建築位置：
- chinese / boss / english        (row 0)
- shop / exam / museum            (row 1)
- pvp / farm / quest              (row 2)
- math / social / science         (row 3)

每棟 = 4 點菱形（diamond）：上、右、下、左四個頂點
派派之後在 map-editor 微調即可。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "assets" / "world_map_config.json"

# 12 棟 in 3 列 × 4 行 grid 排列（依 world_map_iso.png 觀察）
# col_x: 3 列水平中心 x
# row_y: 4 行垂直中心 y
COL_X = [0.18, 0.50, 0.82]
ROW_Y = [0.11, 0.32, 0.55, 0.78]

# 菱形半寬 / 半高（isometric 透視，寬 > 高 約 1.4:1）
DIAMOND_HW = 0.13   # 半寬
DIAMOND_HH = 0.09   # 半高

# 12 棟對應 (row, col) + 既有 schema 資料
BUILDINGS = [
    # row 0
    {"row": 0, "col": 0, "id": "chinese_island",  "name": "國語島",     "category": "education_chinese", "mask_color": "#FF3B30", "interaction_type": "navigation"},
    {"row": 0, "col": 1, "id": "boss_tower",      "name": "魔王塔",     "category": "combat_pve",        "mask_color": "#6F2DA8", "interaction_type": "trigger_event"},
    {"row": 0, "col": 2, "id": "english_castle",  "name": "英文島",     "category": "education_english", "mask_color": "#0A84FF", "interaction_type": "navigation"},
    # row 1
    {"row": 1, "col": 0, "id": "shop",            "name": "商店",       "category": "commerce",          "mask_color": "#FF9500", "interaction_type": "open_modal"},
    {"row": 1, "col": 1, "id": "exam_center",     "name": "考試中心",   "category": "examination",       "mask_color": "#E5E5EA", "interaction_type": "navigation"},
    {"row": 1, "col": 2, "id": "museum",          "name": "偉人館",     "category": "culture",           "mask_color": "#5AC8FA", "interaction_type": "open_modal"},
    # row 2
    {"row": 2, "col": 0, "id": "pvp_arena",       "name": "PK 競技場",  "category": "combat_pvp",        "mask_color": "#BF5AF2", "interaction_type": "trigger_event"},
    {"row": 2, "col": 1, "id": "farm",            "name": "農田",       "category": "agriculture",       "mask_color": "#FFCC00", "interaction_type": "navigation"},
    {"row": 2, "col": 2, "id": "quest_board",     "name": "任務告示板", "category": "quest_board",       "mask_color": "#8B5A2B", "interaction_type": "open_modal"},
    # row 3
    {"row": 3, "col": 0, "id": "math_island",     "name": "數學島",     "category": "education_math",    "mask_color": "#FFD60A", "interaction_type": "navigation"},
    {"row": 3, "col": 1, "id": "social_island",   "name": "社會島",     "category": "education_social",  "mask_color": "#30D158", "interaction_type": "navigation"},
    {"row": 3, "col": 2, "id": "science_island",  "name": "自然島",     "category": "education_science", "mask_color": "#34C759", "interaction_type": "navigation"},
]


def make_diamond(cx, cy, hw=DIAMOND_HW, hh=DIAMOND_HH):
    """4 點菱形：上、右、下、左"""
    return [
        {"x": cx,      "y": cy - hh},  # 上
        {"x": cx + hw, "y": cy},        # 右
        {"x": cx,      "y": cy + hh},  # 下
        {"x": cx - hw, "y": cy},        # 左
    ]


def bbox_from_polygon(poly):
    xs = [p["x"] for p in poly]
    ys = [p["y"] for p in poly]
    return {"x_min": min(xs), "y_min": min(ys), "x_max": max(xs), "y_max": max(ys)}


def main():
    config = {
        "map_config": {
            "dimensions": {"width": 1024, "height": 1024},
            "buildings": [],
            "connections": [],
        }
    }

    for b in BUILDINGS:
        cx, cy = COL_X[b["col"]], ROW_Y[b["row"]]
        poly = make_diamond(cx, cy)
        config["map_config"]["buildings"].append({
            "id": b["id"],
            "name": b["name"],
            "category": b["category"],
            "center": {"x": cx, "y": cy},
            "bounding_box": bbox_from_polygon(poly),
            "mask_color": b["mask_color"],
            "render_order": int((b["row"] + 1) * 100 + b["col"]),
            "interaction_type": b["interaction_type"],
            "polygon": poly,
            "path": [],
        })

    # connections: 同列水平 + 同行垂直連線（簡單規則：相鄰格 = bridge）
    rows = 4
    cols = 3
    id_grid = [[None]*cols for _ in range(rows)]
    for b in BUILDINGS:
        id_grid[b["row"]][b["col"]] = b["id"]
    conns = []
    for r in range(rows):
        for c in range(cols):
            if c < cols - 1:
                conns.append({"from": id_grid[r][c], "to": id_grid[r][c+1], "type": "road"})
            if r < rows - 1:
                conns.append({"from": id_grid[r][c], "to": id_grid[r+1][c], "type": "road"})
    config["map_config"]["connections"] = conns

    with open(CONFIG, "w") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    print(f"✓ {CONFIG.name}: {len(BUILDINGS)} 棟菱形 polygon + {len(conns)} 條 road connections")


if __name__ == "__main__":
    main()
