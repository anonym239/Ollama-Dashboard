#!/usr/bin/env sh
# Startet das Ollama Dashboard (Linux/macOS)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js wurde nicht gefunden. Bitte installiere Node.js (>= 18) von https://nodejs.org"
  exit 1
fi
exec node server.js
