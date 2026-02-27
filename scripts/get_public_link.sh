#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_FILE="$RUNTIME_DIR/cloudflared.log"
URL_FILE="$RUNTIME_DIR/public_url.txt"

if [[ -f "$URL_FILE" ]]; then
  cat "$URL_FILE"
  exit 0
fi

if [[ -f "$LOG_FILE" ]]; then
  URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG_FILE" | head -n 1 || true)"
  if [[ -n "$URL" ]]; then
    echo "$URL"
    exit 0
  fi
fi

echo "Link publik belum tersedia. Jalankan: ./scripts/start_no_card.sh" >&2
exit 1
