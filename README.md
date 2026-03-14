# Turn Off Displays

Stream Deck plugin for macOS that turns off all connected displays without putting the Mac to sleep.

## How it works

When the action is pressed, the plugin backend runs:

```sh
/usr/bin/pmset displaysleepnow
```

This matches the documented macOS display-sleep command and avoids synthetic keypresses or private APIs.

The canonical full-color key icon source lives at `assets/icons/sleep-icon.svg`.
Stream Deck key/plugin PNGs and Marketplace mockups should derive from that SVG so the icon geometry stays consistent everywhere.
The monochrome action/category icons are still derived from official [Lucide](https://lucide.dev/) glyphs.

## Development

Install dependencies:

```sh
npm install
```

Build the plugin:

```sh
npm run build
```

`npm run build` regenerates the Stream Deck PNG icon assets before bundling the plugin code.

Validate the manifest and bundle:

```sh
npm run validate
```

Link the plugin into Stream Deck for local development:

```sh
streamdeck link com.waleed-salama.turn-off-displays.sdPlugin
```

Watch and rebuild on changes:

```sh
npm run watch
```

`npm run watch` also refreshes the generated PNG icons before starting Rollup watch mode.

Create a distributable `.streamDeckPlugin` bundle:

```sh
npm run pack
```

## Notes

- The manifest is macOS-only.
- The generated PNG icons use transparent backgrounds so Stream Deck's own key rendering shows through.
- Marketplace thumbnails and gallery mockups are rendered from the HTML/CSS sources in `assets/marketplace/src/`, which reference `assets/icons/sleep-icon.svg` as the source of truth.
- If the displays wake immediately after sleeping, another process is likely holding a power assertion. `pmset -g assertions` is the first thing to inspect.

## Marketplace Prep

Submission-oriented assets and notes live in [MARKETPLACE.md](./MARKETPLACE.md) and `assets/marketplace/`.
The repo includes a Maker Console app icon, thumbnail, and three gallery images, plus editable HTML/CSS source files for those exports.
