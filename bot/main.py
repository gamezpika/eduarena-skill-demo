"""EduArena Demo Bot — 加好友自動發 demo 連結；收任何文字也回連結。

環境變數：
- LINE_CHANNEL_SECRET
- LINE_CHANNEL_ACCESS_TOKEN
- DEMO_BASE_URL (optional, default eduarena-skill-demo Railway URL)
"""
import logging
import os

from fastapi import FastAPI, Request, HTTPException
from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    ApiClient,
    Configuration,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage,
)
from linebot.v3.webhooks import (
    FollowEvent,
    MessageEvent,
    TextMessageContent,
)

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

config = Configuration(access_token=CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(CHANNEL_SECRET)

app = FastAPI(title="EduArena Demo Bot")


@app.get("/")
def health():
    return {"status": "ok", "service": "eduarena-demo-bot"}


@app.post("/webhook")
async def webhook(request: Request):
    signature = request.headers.get("X-Line-Signature", "")
    body = (await request.body()).decode("utf-8")
    log.info("[webhook] %s bytes", len(body))
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        log.warning("[webhook] invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")
    return "OK"


def _reply(reply_token: str, text: str) -> None:
    with ApiClient(config) as api:
        MessagingApi(api).reply_message(
            ReplyMessageRequest(
                reply_token=reply_token,
                messages=[TextMessage(text=text)],
            )
        )


@handler.add(FollowEvent)
def on_follow(event: FollowEvent):
    log.info("[follow] user=%s", event.source.user_id)
    _reply(event.reply_token, WELCOME)


@handler.add(MessageEvent, message=TextMessageContent)
def on_text(event: MessageEvent):
    log.info("[text] user=%s msg=%r",
             event.source.user_id, event.message.text)
    _reply(event.reply_token, WELCOME)
