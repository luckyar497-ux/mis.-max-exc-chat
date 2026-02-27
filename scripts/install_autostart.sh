#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/com.maxexc.nocard.plist"
START_SCRIPT="$ROOT_DIR/scripts/start_no_card.sh"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$ROOT_DIR/.runtime"

if [[ ! -x "$START_SCRIPT" ]]; then
  chmod +x "$ROOT_DIR/scripts/start_no_card.sh"
fi

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.maxexc.nocard</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$START_SCRIPT</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>WorkingDirectory</key>
    <string>$ROOT_DIR</string>

    <key>StandardOutPath</key>
    <string>$ROOT_DIR/.runtime/launchd.out.log</string>

    <key>StandardErrorPath</key>
    <string>$ROOT_DIR/.runtime/launchd.err.log</string>
  </dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "Autostart aktif saat login macOS."
echo "Cek link publik: ./scripts/get_public_link.sh"
