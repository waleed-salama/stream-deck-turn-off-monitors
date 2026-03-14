# Turn Off Displays

Stream Deck plugin for macOS that turns off all connected displays without putting the Mac to sleep.

## How it works

When the action is pressed, the plugin backend runs:

```sh
/usr/bin/pmset displaysleepnow
```

This matches the documented macOS display-sleep command and avoids synthetic keypresses or private APIs.

The plugin icons are rendered from official [Lucide](https://lucide.dev/) SVG glyphs and exported as transparent PNGs for Stream Deck.

## Development

Install dependencies:

```sh
npm install
```

Build the plugin:

```sh
npm run build
```

`npm run build` regenerates the PNG icon assets before bundling the plugin code.

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
- If the displays wake immediately after sleeping, another process is likely holding a power assertion. `pmset -g assertions` is the first thing to inspect.
