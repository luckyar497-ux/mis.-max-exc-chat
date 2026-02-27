#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
mkdir -p "$RUNTIME_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm tidak ditemukan. Install Node.js dulu."
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared tidak ditemukan. Install dulu agar tunnel publik bisa jalan."
  exit 1
fi

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Server sudah aktif di port 3000."
else
  echo "Menyalakan backend..."
  nohup npm --prefix "$ROOT_DIR/backend" start > "$RUNTIME_DIR/backend.log" 2>&1 &
  echo $! > "$RUNTIME_DIR/backend.pid"
fi

sleep 1

if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Backend gagal jalan. Cek log: $RUNTIME_DIR/backend.log"
  exit 1
fi

if [[ -f "$RUNTIME_DIR/cloudflared.pid" ]] && ps -p "$(cat "$RUNTIME_DIR/cloudflared.pid")" >/dev/null 2>&1; then
  echo "Tunnel cloudflared sudah aktif."
else
  echo "Menyalakan tunnel cloudflared..."
  nohup cloudflared tunnel --url http://localhost:3000 > "$RUNTIME_DIR/cloudflared.log" 2>&1 &
  echo $! > "$RUNTIME_DIR/cloudflared.pid"
fi

sleep 3
PUBLIC_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$RUNTIME_DIR/cloudflared.log" | head -n 1 || true)"

if [[ -n "$PUBLIC_URL" ]]; then
  echo "Web publik aktif: $PUBLIC_URL"
else
  echo "Tunnel berjalan, tapi URL belum terbaca. Cek log: $RUNTIME_DIR/cloudflared.log"
fi

echo "LAN: http://$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo localhost):3000"
