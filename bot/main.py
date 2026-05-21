"""EduArena Demo Bot — 手動 parse webhook（不依賴 SDK handler，更穩）

環境變數：
- LINE_CHANNEL_SECRET
- LINE_CHANNEL_ACCESS_TOKEN
- DEMO_BASE_URL (optional)
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import urllib.request

from fastapi import FastAPI, HTTPException, Request

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("eduarena-demo-bot")

CHANNEL_SECRET = os.environ["LINE_CHANNEL_SECRET"]
CHANNEL_ACCESS_TOKEN = os.environ["LINE_CHANNEL_ACCESS_TOKEN"]
DEMO_BASE_URL = os.environ.get(
    "DEMO_BASE_URL",
    "https://eduarena-skill-demo-production.up.railway.app",
).rstrip("/")

WELCOME = f"""歡迎來看 EduArena 技術 demo 👋

🎮 整套 demo 入口（4 種地圖）：
{DEMO_BASE_URL}/

或直接看單一 demo：
🌊 海洋地圖 → {DEMO_BASE_URL}/ocean.html
🏝 村莊地圖 → {DEMO_BASE_URL}/village.html
🏛 名人九宮格 → {DEMO_BASE_URL}/figures.html
🗺 探索地圖 → {DEMO_BASE_URL}/world.html

💡 可以直接打字告訴我想看哪個（如「海洋」、「名人」、「探索」）"""

# 關鍵字分流 → 對應單一 demo
ROUTES = [
    (["海洋", "海", "ocean", "wave", "藍"],
     "🌊 海洋地圖 — DOGTOR 風 3D 透視縮放\n" + DEMO_BASE_URL + "/ocean.html"),
    (["村莊", "村", "村落", "village", "建築", "hotspot"],
     "🏝 村莊地圖 — 手繪 2.5D 大場景，10 個建築 hotspot\n" + DEMO_BASE_URL + "/village.html"),
    (["偉人", "名人", "九宮格", "翻牌", "歷史", "figures", "李白", "孔子"],
     "🏛 名人九宮格 — 5 階段翻牌猜偉人遊戲\n" + DEMO_BASE_URL + "/figures.html"),
    (["探索", "世界", "地圖", "拖曳", "world", "農田", "商店", "考試"],
     "🗺 探索地圖 — 可上下左右拖曳大世界\n" + DEMO_BASE_URL + "/world.html"),
    (["全部", "整套", "menu", "hub", "首頁", "目錄", "看看"],
     "🎮 整套 demo 入口（4 種地圖）：\n" + DEMO_BASE_URL + "/"),
]

def route_text(text: str) -> str:
    """根據訊息內容分流；找不到關鍵字就回完整歡迎。"""
    if not text:
        return WELCOME
    t = text.lower()
    for keywords, reply_text in ROUTES:
        for k in keywords:
            if k.lower() in t:
                return reply_text
    return WELCOME

app = FastAPI(title="EduArena Demo Bot")


@app.get("/")
def health():
    return {"status": "ok", "service": "eduarena-demo-bot"}


def verify_signature(body: bytes, signature: str) -> bool:
    mac = hmac.new(CHANNEL_SECRET.encode(), body, hashlib.sha256).digest()
    expected = base64.b64encode(mac).decode()
    return hmac.compare_digest(expected, signature)


def reply(reply_token: str, text: str) -> None:
    req = urllib.request.Request(
        "https://api.line.me/v2/bot/message/reply",
        data=json.dumps(
            {
                "replyToken": reply_token,
                "messages": [{"type": "text", "text": text}],
            },
            ensure_ascii=False,
        ).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {CHANNEL_ACCESS_TOKEN}",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        log.info("[reply] %d", resp.status)
    except Exception as e:
        log.error("[reply] failed: %s", e)


@app.post("/webhook")
async def webhook(request: Request):
    signature = request.headers.get("X-Line-Signature", "")
    body = await request.body()
    if not verify_signature(body, signature):
        log.warning("[webhook] signature invalid (len=%d)", len(body))
        raise HTTPException(status_code=400, detail="Invalid signature")
    try:
        payload = json.loads(body)
    except Exception as e:
        log.error("[webhook] bad json: %s", e)
        return "OK"

    for event in payload.get("events", []):
        et = event.get("type")
        rt = event.get("replyToken")
        log.info("[event] type=%s", et)
        if et == "follow" and rt:
            reply(rt, WELCOME)
        elif et == "message" and rt:
            mt = event.get("message", {}).get("type")
            log.info("[event.message] type=%s", mt)
            if mt == "text":
                text = event.get("message", {}).get("text", "")
                reply(rt, route_text(text))
            else:
                # 貼圖/圖片/位置等非文字 → 回完整歡迎
                reply(rt, WELCOME)
        else:
            log.info("[event] ignored type=%s", et)
    return "OK"
