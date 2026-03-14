#!/usr/bin/env bash

set -euo pipefail

# Compiles the bundled macOS helper used for optional lock/audio-state
# management. The binary is emitted directly into the `.sdPlugin/bin` folder so
# Stream Deck packaging picks it up automatically.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/com.waleed-salama.turn-off-displays.sdPlugin"
HELPER_SOURCE="$ROOT_DIR/helpers/AwayAudioHelper.swift"
HELPER_OUTPUT="$PLUGIN_DIR/bin/away-audio-helper"

warn() {
  printf 'warning: %s\n' "$1" >&2
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  warn "macOS helper build skipped because the current platform is not macOS."
  exit 0
fi

if ! command -v swiftc >/dev/null 2>&1; then
  warn "Swift compiler not found; skipping macOS helper build."
  exit 0
fi

mkdir -p "$PLUGIN_DIR/bin"

swiftc \
  -O \
  -framework AppKit \
  "$HELPER_SOURCE" \
  -o "$HELPER_OUTPUT"
