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

🌊 海洋地圖
{DEMO_BASE_URL}/

🗺 探索地圖
{DEMO_BASE_URL}/world.html"""

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
            reply(rt, WELCOME)  # 任何訊息類型都回歡迎
        else:
            log.info("[event] ignored type=%s", et)
    return "OK"
