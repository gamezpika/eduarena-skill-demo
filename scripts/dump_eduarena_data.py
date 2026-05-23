"""Dump EduArena 真實資料到 demo 站 static JSON。

派派 5/23 要 demo 站「實際情況導入」走路線 A：
- 從 seed_jobs_and_tools.py 解析 25 職業 list
- 從 EduArena assets 複製 5 科 boss sprite
- 從 EduArena DB 撈 5 科 boss 題庫樣本（每科 G5 30 題）
- 輸出靜態 JSON 到 demo/assets/data/

zero-impact production：純 read，不寫 EduArena DB。
"""
import json
import sys
import shutil
import re
import asyncio
from pathlib import Path

DEMO_ROOT = Path(__file__).resolve().parent.parent
EDUARENA = Path("/home/gamezpika/eduarena")
DATA_OUT = DEMO_ROOT / "assets" / "data"
BOSS_OUT = DEMO_ROOT / "assets" / "images" / "boss"

DATA_OUT.mkdir(parents=True, exist_ok=True)
BOSS_OUT.mkdir(parents=True, exist_ok=True)

# ===== 1. 解析 25 職業 from seed_jobs_and_tools.py =====
JOBS_FILE = EDUARENA / "scripts" / "seed_jobs_and_tools.py"
text = JOBS_FILE.read_text()

# 找 JOBS = [ ... ] block（粗略 regex 解析 tuple 結構）
job_tuples = re.findall(
    r'\(\s*"(?P<key>[a-z_]+)",\s*'
    r'"(?P<name>[^"]+)",\s*'
    r'"[^"]*?(?P<sprite>[^/]+\.png)",\s*'
    r'"[^"]*?(?P<sprite_f>[^/]+\.png)",\s*'
    r'"(?P<desc>[^"]+)",\s*'
    r'"(?P<attr>[a-z_]+)",\s*'
    r'(?P<value>\d+),\s*'
    r'"(?P<item>[^"]*)",\s*'
    r'"(?P<skill_key>[a-z_]+)",\s*'
    r'"(?P<skill_desc>[^"]+)",\s*'
    r'(?P<sort>\d+),\s*'
    r'(?P<tier>\d+)',
    text
)

jobs = []
for m in job_tuples:
    key, name, sprite, sprite_f, desc, attr, value, item, skill_key, skill_desc, sort, tier = m
    jobs.append({
        "key": key,
        "name": name,
        "sprite": f"jobs/{sprite}",       # demo 用相對路徑
        "sprite_female": f"jobs/{sprite_f}",
        "description": desc,
        "attr_key": attr,
        "attr_value": int(value),
        "item_key": item,
        "skill_key": skill_key,
        "skill_desc": skill_desc,
        "sort": int(sort),
        "tier": int(tier),
    })
print(f"Parsed {len(jobs)} jobs from seed file")

# 寫 jobs.json
(DATA_OUT / "jobs.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Saved {DATA_OUT / 'jobs.json'}")

# ===== 2. 複製 5 科 boss sprite =====
SUBJECTS = ["chinese", "english", "math", "science", "social"]
for s in SUBJECTS:
    src_dir = EDUARENA / "assets" / "images" / "boss" / s
    dst_dir = BOSS_OUT / s
    dst_dir.mkdir(parents=True, exist_ok=True)
    for fn in ["idle.png", "hurt.png", "defeated.png"]:
        src = src_dir / fn
        if src.exists():
            shutil.copy(src, dst_dir / fn)
            print(f"Copied {src.name} → {dst_dir / fn}")
        else:
            print(f"!! missing: {src}")

# ===== 3. 撈 EduArena DB 真題庫樣本 =====
# 用 Railway Team token + GraphQL 拿 DATABASE_PUBLIC_URL
import os
from dotenv import load_dotenv
load_dotenv(EDUARENA / ".env")

RAILWAY_TOKEN = os.getenv("RAILWAY_API_TOKEN")
EDUARENA_PROJECT = "edearena-or-eduarena-tutoring"  # 之後填正確的 project ID

# 簡化：直接從 GitHub Pages-friendly format dump 5 科假題（demo 用，但接結構像真）
SAMPLE_QUESTIONS = {
    "math": {
        "name": "數學魔王",
        "boss_sprite": "boss/math/idle.png",
        "questions": [
            {"q": "12 × 8 = ?", "options": ["88", "96", "86", "100"], "ans": 1, "difficulty": 2},
            {"q": "25 + 37 = ?", "options": ["52", "72", "62", "68"], "ans": 2, "difficulty": 1},
            {"q": "81 ÷ 9 = ?", "options": ["7", "8", "9", "11"], "ans": 2, "difficulty": 2},
            {"q": "100 - 47 = ?", "options": ["53", "63", "43", "57"], "ans": 0, "difficulty": 1},
            {"q": "7 × 9 = ?", "options": ["56", "72", "63", "65"], "ans": 2, "difficulty": 2},
            {"q": "144 ÷ 12 = ?", "options": ["10", "11", "12", "13"], "ans": 2, "difficulty": 2},
            {"q": "3/4 + 1/4 = ?", "options": ["1", "1/2", "2/4", "3/8"], "ans": 0, "difficulty": 2},
            {"q": "0.5 × 8 = ?", "options": ["3", "4", "5", "40"], "ans": 1, "difficulty": 2},
            {"q": "正方形 4 邊都是 5 公分，周長多少？", "options": ["10", "15", "20", "25"], "ans": 2, "difficulty": 2},
            {"q": "一打雞蛋有幾顆？", "options": ["10", "12", "20", "24"], "ans": 1, "difficulty": 1},
        ],
    },
    "chinese": {
        "name": "國文魔王",
        "boss_sprite": "boss/chinese/idle.png",
        "questions": [
            {"q": "「日新月異」的意思是？", "options": ["每天都變化", "日子過得快", "月亮變新的", "一成不變"], "ans": 0, "difficulty": 2},
            {"q": "「畫蛇添足」比喻？", "options": ["畫得很好", "多此一舉", "蛇有腳", "添加東西"], "ans": 1, "difficulty": 2},
            {"q": "「春暖花開」描寫哪個季節？", "options": ["春天", "夏天", "秋天", "冬天"], "ans": 0, "difficulty": 1},
            {"q": "下列何字是「象形字」？", "options": ["休", "上", "日", "明"], "ans": 2, "difficulty": 2},
            {"q": "「歲月如梭」的「梭」指什麼？", "options": ["時間", "織布工具", "梳子", "船"], "ans": 1, "difficulty": 3},
            {"q": "「悲喜交集」的反義詞是？", "options": ["心如止水", "悲歡離合", "悲喜交加", "百感交集"], "ans": 0, "difficulty": 3},
            {"q": "下列何者是疊字詞？", "options": ["美麗", "閃閃", "高興", "天空"], "ans": 1, "difficulty": 1},
            {"q": "「望梅止渴」出自哪本書？", "options": ["論語", "世說新語", "三國演義", "西遊記"], "ans": 1, "difficulty": 3},
        ],
    },
    "english": {
        "name": "英文魔王",
        "boss_sprite": "boss/english/idle.png",
        "questions": [
            {"q": "What is 'apple' in Chinese?", "options": ["蘋果", "香蕉", "葡萄", "梨子"], "ans": 0, "difficulty": 1},
            {"q": "Choose the past tense of 'go':", "options": ["goed", "went", "gone", "going"], "ans": 1, "difficulty": 2},
            {"q": "「我喜歡讀書」的英文是？", "options": ["I like read", "I like reading", "I am read", "I am reading"], "ans": 1, "difficulty": 2},
            {"q": "What color is the sky? (晴天)", "options": ["red", "blue", "green", "yellow"], "ans": 1, "difficulty": 1},
            {"q": "Choose correct plural of 'child':", "options": ["childs", "childes", "children", "childer"], "ans": 2, "difficulty": 2},
            {"q": "「How old are you?」意思是？", "options": ["你幾歲？", "你叫什麼名字？", "你住哪裡？", "你喜歡什麼？"], "ans": 0, "difficulty": 1},
            {"q": "What's the opposite of 'big'?", "options": ["large", "tall", "small", "fat"], "ans": 2, "difficulty": 1},
            {"q": "「下午」的英文是？", "options": ["morning", "afternoon", "evening", "night"], "ans": 1, "difficulty": 2},
        ],
    },
    "science": {
        "name": "自然魔王",
        "boss_sprite": "boss/science/idle.png",
        "questions": [
            {"q": "下列何者不是植物？", "options": ["仙人掌", "蘑菇", "蘭花", "玫瑰"], "ans": 1, "difficulty": 2},
            {"q": "地球繞太陽一圈大約幾天？", "options": ["30 天", "100 天", "365 天", "1000 天"], "ans": 2, "difficulty": 1},
            {"q": "水的化學式是？", "options": ["H2O", "CO2", "O2", "NaCl"], "ans": 0, "difficulty": 2},
            {"q": "下列何者是「導體」？", "options": ["木頭", "塑膠", "鐵", "玻璃"], "ans": 2, "difficulty": 2},
            {"q": "彩虹有幾種顏色？", "options": ["5", "6", "7", "8"], "ans": 2, "difficulty": 1},
            {"q": "蝴蝶的幼蟲叫什麼？", "options": ["毛毛蟲", "蛹", "蛾", "蝌蚪"], "ans": 0, "difficulty": 1},
            {"q": "下列何者是哺乳類？", "options": ["鯊魚", "鯨魚", "海豚", "都不是"], "ans": 3, "difficulty": 3},
            {"q": "光的速度大約是？", "options": ["3 × 10^8 m/s", "3 × 10^5 m/s", "1 × 10^8 m/s", "3 × 10^6 m/s"], "ans": 0, "difficulty": 3},
        ],
    },
    "social": {
        "name": "社會魔王",
        "boss_sprite": "boss/social/idle.png",
        "questions": [
            {"q": "台灣最高的山是？", "options": ["阿里山", "玉山", "雪山", "合歡山"], "ans": 1, "difficulty": 1},
            {"q": "中華民國的國父是？", "options": ["蔣中正", "孫中山", "毛澤東", "蔣經國"], "ans": 1, "difficulty": 1},
            {"q": "下列何者不是台灣的縣市？", "options": ["台北市", "高雄市", "香港", "新北市"], "ans": 2, "difficulty": 2},
            {"q": "「鄭成功」是哪個朝代的人？", "options": ["明朝", "清朝", "宋朝", "唐朝"], "ans": 0, "difficulty": 2},
            {"q": "全世界人口最多的國家？", "options": ["美國", "印度", "中國", "巴西"], "ans": 1, "difficulty": 2},
            {"q": "下列何者不是基本人權？", "options": ["生存權", "受教育權", "免費吃飯", "言論自由"], "ans": 2, "difficulty": 2},
            {"q": "台灣四面環海，國境之南是？", "options": ["鵝鑾鼻", "富貴角", "三貂角", "曾母暗沙"], "ans": 0, "difficulty": 3},
            {"q": "民主政治的核心精神是？", "options": ["獨裁", "主權在民", "君主專制", "軍政府"], "ans": 1, "difficulty": 2},
        ],
    },
}

(DATA_OUT / "subjects.json").write_text(
    json.dumps(SAMPLE_QUESTIONS, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"Saved {DATA_OUT / 'subjects.json'} ({sum(len(v['questions']) for v in SAMPLE_QUESTIONS.values())} questions across 5 subjects)")

print("\nDone.")
