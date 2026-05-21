# EduArena Demo Bot

加好友自動發 demo 連結；收任何文字也回連結。

## 部署

**Railway**：在 `eduarena-skill-demo` project 內新增第 2 個 service。
- **Root Directory**: `/bot`
- **環境變數**：
  - `LINE_CHANNEL_SECRET`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `DEMO_BASE_URL` (optional, default 是 demo 站 Railway URL)

## Webhook URL

部署完 + Generate Domain 後：
```
https://<bot-service>.up.railway.app/webhook
```

把這個 URL 填到 LINE Developers Console → EduArena Demo Channel → Messaging API → Webhook URL → 啟用。

## 本地測試（optional）

```bash
cd bot
pip install -r requirements.txt
export LINE_CHANNEL_SECRET=xxx
export LINE_CHANNEL_ACCESS_TOKEN=yyy
uvicorn main:app --reload --port 8080
```
