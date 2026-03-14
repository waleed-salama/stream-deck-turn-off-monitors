#!/usr/bin/env bash

set -euo pipefail

# Regenerates the PNG assets embedded in the Stream Deck plugin bundle.
#
# The full-color key icon source of truth is `assets/icons/sleep-icon.svg`.
# Monochrome action/category icons still come from official Lucide SVG glyphs
# inside `node_modules/lucide-static`. Marketplace screenshots and thumbnails
# are maintained separately from the HTML/CSS sources under `assets/marketplace/src/`
# so `npm run build` cannot overwrite curated listing media.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/com.waleed-salama.turn-off-displays.sdPlugin"
LUCIDE_DIR="$ROOT_DIR/node_modules/lucide-static/icons"
ACTION_DIR="$PLUGIN_DIR/imgs/actions/sleep-displays"
PLUGIN_IMG_DIR="$PLUGIN_DIR/imgs/plugin"
KEY_SOURCE_SVG="$ROOT_DIR/assets/icons/sleep-icon.svg"
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
rm -f "$PLUGIN_IMG_DIR/marketplace.png" "$PLUGIN_IMG_DIR/marketplace@2x.png"

# Rewrites Lucide's `currentColor` stroke into a concrete hex value so the SVG
# can be rasterized consistently by ImageMagick.
paint_svg() {
  local source="$1"
  local color="$2"
  local destination="$3"

  sed "s|currentColor|$color|g" "$source" > "$destination"
}

# Rasterizes an SVG into an exact PNG size. `rsvg-convert` is preferred because
# it preserves the icon geometry more cleanly than the ImageMagick SVG fallback.
render_svg_png() {
  local source="$1"
  local width="$2"
  local height="$3"
  local destination="$4"

  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert --keep-aspect-ratio --width "$width" --height "$height" "$source" > "$destination"
    return
  fi

  magick -background none "$source" -resize "${width}x${height}" "$destination"
}

MONITOR_OFF_SVG="$TMP_DIR/monitor-off.svg"
MOON_STAR_SVG="$TMP_DIR/moon-star.svg"
MONITOR_DIM_SVG="$TMP_DIR/monitor-dim.svg"
MONITOR_WHITE_SVG="$TMP_DIR/monitor-white.svg"
MOON_AMBER_SVG="$TMP_DIR/moon-amber.svg"
KEY_144_PNG="$TMP_DIR/plugin-key-144.png"
KEY_180_PNG="$TMP_DIR/plugin-key-180.png"
KEY_288_PNG="$TMP_DIR/plugin-key-288.png"
KEY_360_PNG="$TMP_DIR/plugin-key-360.png"

paint_svg "$LUCIDE_DIR/monitor-off.svg" "#E5E7EB" "$MONITOR_OFF_SVG"
paint_svg "$LUCIDE_DIR/moon-star.svg" "#FBBF24" "$MOON_STAR_SVG"
paint_svg "$LUCIDE_DIR/monitor-off.svg" "#CBD5E1" "$MONITOR_DIM_SVG"
paint_svg "$LUCIDE_DIR/monitor-off.svg" "#FFFFFF" "$MONITOR_WHITE_SVG"
paint_svg "$LUCIDE_DIR/moon-star.svg" "#FBBF24" "$MOON_AMBER_SVG"
render_svg_png "$KEY_SOURCE_SVG" 144 144 "$KEY_144_PNG"
render_svg_png "$KEY_SOURCE_SVG" 180 180 "$KEY_180_PNG"
render_svg_png "$KEY_SOURCE_SVG" 288 288 "$KEY_288_PNG"
render_svg_png "$KEY_SOURCE_SVG" 360 360 "$KEY_360_PNG"

# Action list icon (20x20 and 40x40) should be monochrome white on transparent.
magick -size 20x20 xc:none \
  \( -background none "$MONITOR_WHITE_SVG" -resize 18x18 \) -gravity center -geometry -1+1 -composite \
  "$ACTION_DIR/icon.png"

magick -size 40x40 xc:none \
  \( -background none "$MONITOR_WHITE_SVG" -resize 36x36 \) -gravity center -geometry -2+2 -composite \
  "$ACTION_DIR/icon@2x.png"

# Key image shown on the Stream Deck hardware itself.
cp "$KEY_144_PNG" "$ACTION_DIR/key.png"
cp "$KEY_288_PNG" "$ACTION_DIR/key@2x.png"

# Small plugin category icon used inside the Stream Deck application UI.
magick -size 28x28 xc:none \
  \( -background none "$MONITOR_WHITE_SVG" -resize 24x24 \) -gravity center -geometry -1+1 -composite \
  "$PLUGIN_IMG_DIR/category-icon.png"

magick -size 56x56 xc:none \
  \( -background none "$MONITOR_WHITE_SVG" -resize 48x48 \) -gravity center -geometry -2+2 -composite \
  "$PLUGIN_IMG_DIR/category-icon@2x.png"

# Stream Deck plugin icon (256x256 and 512x512) shown in preferences.
magick -size 256x256 xc:'#0F172A' \
  -fill none -stroke '#1E293B' -strokewidth 4 -draw 'roundrectangle 6,6 250,250 44,44' \
  \( "$KEY_180_PNG" \) -gravity center -geometry +0+0 -composite \
  "$PLUGIN_IMG_DIR/icon.png"

magick -size 512x512 xc:'#0F172A' \
  -fill none -stroke '#1E293B' -strokewidth 8 -draw 'roundrectangle 12,12 500,500 88,88' \
  \( "$KEY_360_PNG" \) -gravity center -geometry +0+0 -composite \
  "$PLUGIN_IMG_DIR/icon@2x.png"
