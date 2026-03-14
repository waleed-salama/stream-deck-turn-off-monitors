# Architecture

## Objective

Design a Stream Deck plugin that exposes a button action to switch off all connected displays on macOS without putting the machine to sleep.

## Candidate Shape

### Current recommendation

Use a standard Node-based Stream Deck plugin with a single macOS-focused action whose backend invokes `/usr/bin/pmset displaysleepnow` on macOS.

### Why this shape

- `pmset displaysleepnow` is the only documented user-space mechanism found so far that directly maps to the desired behavior.
- It avoids Accessibility / synthetic input permissions that keyboard-event approaches would require.
- It avoids unsupported private APIs.
- It matches Elgato's recommended plugin model: standard Node backend first, native-only approaches only when truly necessary.

### Provisional execution flow

1. User presses a Stream Deck key bound to the plugin action.
2. The plugin backend receives the key-down event.
3. On macOS, the backend launches `/usr/bin/pmset` with `displaysleepnow`.
4. The plugin reports success or failure back to the key state and logs any stderr output for debugging.

## Proposed plugin shape

### Manifest

- `SDKVersion`: `3`
- `Nodejs.Version`: `20` or `24`
- `Software.MinimumVersion`: at least `6.9`
- `OS`: macOS only for the first release
- `CodePath`: compiled Node entry point
- `Actions`: one keypad action, for example `turn-off-displays`

### Asset pipeline

- Source icons live in `assets/icons/*.svg`.
- `scripts/render-icons.sh` rasterizes Lucide-based compositions into the action, key, category, and marketplace PNG assets in the `.sdPlugin` bundle.
- The generated PNGs use transparent backgrounds so Stream Deck can render them cleanly on-device.
- The standard `npm run build` path invokes the icon render step before bundling, so generated assets stay in sync with code builds.
- The runtime action no longer overrides the packaged key image, so the rendered Stream Deck assets are the single source of truth for the plugin's visuals.

### Source layout

- `src/plugin.ts` or `src/index.ts`: plugin bootstrap and action registration
- `src/actions/turn-off-displays.ts`: action handler for key presses
- `src/lib/run-display-sleep.ts`: small wrapper around `child_process.execFile` or `spawn`
- `com.your-org.turn-off-displays.sdPlugin/manifest.json`: compiled plugin manifest
- `ui/turn-off-displays.html`: optional property inspector for diagnostics or future settings

### Runtime behavior

- Default press behavior: run `/usr/bin/pmset displaysleepnow`
- Failure behavior:
  - log the command, exit code, stderr, and timestamp
  - optionally show an alert state on the key
- Optional debug behavior:
  - expose a property-inspector toggle or second action that captures `pmset -g assertions`
  - use this when displays immediately wake again

## Implementation options

### Option A: Node action + direct `pmset` call

- Backend uses Node's process APIs to execute `/usr/bin/pmset`.
- This is the simplest and most likely first implementation.
- Recommended for v1.

### Option B: Node action + bundled native helper

- Backend executes a bundled macOS helper binary.
- Helper either calls `pmset` or wraps future macOS-specific logic.
- Better if we later want richer diagnostics, code signing separation, or a reusable local utility.

### Option C: Fully native Stream Deck plugin

- Use Elgato's native-plugin WebSocket model as the plugin entry point.
- Rejected for v1 because Elgato documents this as advanced and recommends Node-based plugins or native addons instead.

## Risks and mitigations

- Risk: another process prevents or immediately cancels display sleep.
- Mitigation: capture `pmset -g assertions` output for troubleshooting.

- Risk: direct child-process execution from the plugin backend is constrained in practice even though the Node runtime model suggests it should work.
- Mitigation: keep the display-sleep call behind a small abstraction so we can swap in a native helper without touching the action contract.

- Risk: bundled helper binaries may need Apple signing/notarization for smooth distribution.
- Mitigation: avoid a helper in v1 unless needed; revisit before distribution outside local development.

## Next implementation steps

1. Scaffold a plugin with `streamdeck create`. Completed.
2. Restrict the initial manifest to macOS and a single keypad action. Completed.
3. Implement the action handler to run `/usr/bin/pmset displaysleepnow`. Completed.
4. Add structured logging around command start, exit status, and stderr. Completed.
5. Add a diagnostics path for `pmset -g assertions`. Deferred unless immediate wakeups show up in testing.
6. Test on the target Mac with the actual Stream Deck app and hardware. Pending.
