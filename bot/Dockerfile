FROM python:3.11-slim

WORKDIR /app

# 系統依賴最小化
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway 注入 $PORT；shell form 讓 $PORT 展開
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
