#!/usr/bin/env bash

set -euo pipefail

# Regenerates the PNG assets embedded in the Stream Deck plugin bundle.
#
# The source artwork comes from official Lucide SVG glyphs inside
# `node_modules/lucide-static`. This script tints and composites those glyphs
# into the exact raster sizes Stream Deck expects for action, category, and
# marketplace icons.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/com.waleed-salama.turn-off-displays.sdPlugin"
LUCIDE_DIR="$ROOT_DIR/node_modules/lucide-static/icons"
ACTION_DIR="$PLUGIN_DIR/imgs/actions/sleep-displays"
PLUGIN_IMG_DIR="$PLUGIN_DIR/imgs/plugin"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

warn() {
  printf 'warning: %s\n' "$1" >&2
}

if ! command -v magick >/dev/null 2>&1; then
  warn "ImageMagick ('magick') is not installed; skipping icon generation and keeping existing PNG assets."
  exit 0
fi

mkdir -p "$ACTION_DIR" "$PLUGIN_IMG_DIR"

# Rewrites Lucide's `currentColor` stroke into a concrete hex value so the SVG
# can be rasterized consistently by ImageMagick.
paint_svg() {
  local source="$1"
  local color="$2"
  local destination="$3"

  sed "s|currentColor|$color|g" "$source" > "$destination"
}

MONITOR_OFF_SVG="$TMP_DIR/monitor-off.svg"
MOON_STAR_SVG="$TMP_DIR/moon-star.svg"
MONITOR_DIM_SVG="$TMP_DIR/monitor-dim.svg"

paint_svg "$LUCIDE_DIR/monitor-off.svg" "#E5E7EB" "$MONITOR_OFF_SVG"
paint_svg "$LUCIDE_DIR/moon-star.svg" "#FBBF24" "$MOON_STAR_SVG"
paint_svg "$LUCIDE_DIR/monitor-off.svg" "#CBD5E1" "$MONITOR_DIM_SVG"

# Action list icon (64x64 and 128x128).
magick -size 64x64 xc:none \
  \( -background none "$MONITOR_OFF_SVG" -resize 46x46 \) -gravity center -geometry -3+3 -composite \
  \( "$MOON_STAR_SVG" -resize 18x18 \) -gravity northeast -geometry +6+6 -composite \
  "$ACTION_DIR/icon.png"

magick -size 128x128 xc:none \
  \( -background none "$MONITOR_OFF_SVG" -resize 92x92 \) -gravity center -geometry -6+6 -composite \
  \( "$MOON_STAR_SVG" -resize 36x36 \) -gravity northeast -geometry +12+12 -composite \
  "$ACTION_DIR/icon@2x.png"

# Key image shown on the Stream Deck hardware itself.
magick -size 144x144 xc:none \
  \( -background none "$MONITOR_OFF_SVG" -resize 94x94 \) -gravity center -geometry -4+8 -composite \
  \( "$MOON_STAR_SVG" -resize 30x30 \) -gravity northeast -geometry +20+20 -composite \
  "$ACTION_DIR/key.png"

magick -size 288x288 xc:none \
  \( -background none "$MONITOR_OFF_SVG" -resize 188x188 \) -gravity center -geometry -8+16 -composite \
  \( "$MOON_STAR_SVG" -resize 60x60 \) -gravity northeast -geometry +40+40 -composite \
  "$ACTION_DIR/key@2x.png"

# Small plugin category icon used inside the Stream Deck application UI.
magick -size 28x28 xc:none \
  \( -background none "$MONITOR_DIM_SVG" -resize 20x20 \) -gravity center -geometry -1+1 -composite \
  "$PLUGIN_IMG_DIR/category-icon.png"

magick -size 56x56 xc:none \
  \( -background none "$MONITOR_DIM_SVG" -resize 40x40 \) -gravity center -geometry -2+2 -composite \
  "$PLUGIN_IMG_DIR/category-icon@2x.png"

# Marketplace / plugin tile artwork shown at larger sizes.
magick -size 144x144 xc:none \
  \( -background none "$MONITOR_OFF_SVG" -resize 96x96 \) -gravity center -geometry -6+6 -composite \
  \( "$MOON_STAR_SVG" -resize 28x28 \) -gravity northeast -geometry +18+18 -composite \
  "$PLUGIN_IMG_DIR/marketplace.png"

magick -size 288x288 xc:none \
  \( -background none "$MONITOR_OFF_SVG" -resize 192x192 \) -gravity center -geometry -12+12 -composite \
  \( "$MOON_STAR_SVG" -resize 56x56 \) -gravity northeast -geometry +36+36 -composite \
  "$PLUGIN_IMG_DIR/marketplace@2x.png"
