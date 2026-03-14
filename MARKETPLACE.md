# Marketplace Submission Prep

This repo includes the code package plus the main visual assets needed to prepare a Stream Deck Marketplace submission.

## Included assets

- Plugin package: `com.waleed-salama.turn-off-displays.streamDeckPlugin`
- Stream Deck plugin icon: `com.waleed-salama.turn-off-displays.sdPlugin/imgs/plugin/icon.png` and `icon@2x.png`
- Marketplace app icon: `assets/marketplace/app-icon.png`
- Marketplace thumbnail: `assets/marketplace/thumbnail.png`
- Marketplace gallery images:
  - `assets/marketplace/gallery/gallery-1.png`
  - `assets/marketplace/gallery/gallery-2.png`
  - `assets/marketplace/gallery/gallery-3.png`

## Editable source files

The Marketplace app icon and gallery media are rendered from editable HTML/CSS source files in:

- `assets/marketplace/src/app-icon.html`
- `assets/marketplace/src/gallery-1.html`
- `assets/marketplace/src/gallery-2.html`
- `assets/marketplace/src/gallery-3.html`
- `assets/marketplace/src/base.css`
- `assets/icons/sleep-icon.svg`

## Icon source of truth

- `assets/icons/sleep-icon.svg` is the canonical full-color icon source.
- Marketplace mockups should always reference that SVG directly instead of rebuilding the icon from separate shapes or scaling an old PNG.
- The Stream Deck build pipeline also derives the packaged key and plugin PNGs from that same SVG.
- `npm run build` does not regenerate Marketplace screenshots or thumbnails, so curated listing media in `assets/marketplace/` will not be overwritten during normal plugin builds.
- When previewing the Marketplace HTML locally, serve the repo root or the `assets/` directory so the `assets/marketplace/src/*.html` pages can resolve `assets/icons/sleep-icon.svg`.

## Before submitting

Review these fields in `com.waleed-salama.turn-off-displays.sdPlugin/manifest.json`:

- `Name`
  - Must be unique on Marketplace.
- `Author`
  - Should match your Marketplace organization name.
- `UUID`
  - Do not change this after publishing.

## Current repo decisions

- Action and category icons are monochrome white on transparent backgrounds to align with Elgato's Stream Deck plugin image guidelines.
- Key icons remain separate and can use color because the key-state image rules are less restrictive than action-list icons.
- The plugin icon for Stream Deck preferences is generated at 256×256 and 512×512.
- The Marketplace app icon is generated at 288×288.
- The Marketplace thumbnail is generated at 1920×960.

## Submission checklist

1. Create or confirm your Maker organization in Maker Console.
2. Confirm the plugin name is available on Marketplace.
3. Confirm the `Author` field matches your Maker organization.
4. Build and validate the plugin:

```sh
npm run build
npm run validate
npm run pack -- --force
```

5. Upload these items in Maker Console:
   - the packaged `.streamDeckPlugin`
   - `assets/marketplace/app-icon.png`
   - `assets/marketplace/thumbnail.png`
   - at least three gallery images from `assets/marketplace/gallery/`
   - final description
   - release notes
   - support email or support link
   - pricing / free selection

## Suggested listing copy

### Title

Turn Off Displays

### Short description draft

Turn off all connected macOS displays from a single Stream Deck key without putting the Mac to sleep.

### Release notes draft

- Initial release
- Adds a one-tap action to sleep all connected displays on macOS
- Built for Stream Deck on macOS 12 and later
