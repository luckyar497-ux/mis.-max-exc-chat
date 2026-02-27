#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"

stop_pid_file() {
  local pid_file="$1"
  local name="$2"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if ps -p "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      echo "$name dimatikan (PID $pid)."
    else
      echo "$name sudah tidak berjalan."
    fi
    rm -f "$pid_file"
  else
    echo "PID file $name tidak ditemukan."
  fi
}

stop_pid_file "$RUNTIME_DIR/cloudflared.pid" "cloudflared"
stop_pid_file "$RUNTIME_DIR/backend.pid" "backend"

echo "Selesai."
