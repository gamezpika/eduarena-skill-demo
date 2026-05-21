# Caddy 2 alpine — 輕量 (~50MB)、自動 HTTPS、gzip 內建
FROM caddy:2-alpine

# 複製站台檔案（HTML/CSS/JS/PNG/JPG）
COPY . /srv

# Caddy 設定（監聽 Railway 注入的 $PORT）
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
