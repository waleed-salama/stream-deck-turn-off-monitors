# Research

## Goal

Build a Stream Deck plugin for macOS that turns off all displays while leaving the Mac running.

## Open Questions

- What is the current Stream Deck plugin runtime and packaging model?
- How do Stream Deck actions communicate with native executables on macOS?
- What macOS-supported mechanisms can trigger display sleep without sleeping the computer?
- Which approach is robust on modern macOS versions and compatible with Stream Deck plugin constraints?

## Findings

### Stream Deck plugin model

- Current Stream Deck plugins are local, two-part applications:
  - a backend running in Node.js
  - an optional property inspector UI running in Chromium inside the Stream Deck app
- Elgato's current docs list Stream Deck 7.3 plugin runtimes as Node.js `20.20.0` or `24.13.1`, with Chromium `130`.
- The backend is the part that receives key presses and runs the plugin logic, which makes it the correct place to trigger monitor sleep.
- Elgato's CLI is the standard development path:
  - `streamdeck create` scaffolds a plugin
  - `streamdeck link` installs it locally for development
  - `streamdeck pack` produces a distributable `.streamDeckPlugin`

### Stream Deck manifest and entry points

- `manifest.json` defines the plugin entry point, actions, runtime version, Stream Deck version requirement, and supported operating systems.
- `CodePath` is the main plugin entry point.
- `CodePathMac` and `CodePathWin` allow OS-specific entry points.
- `Nodejs.Version` currently supports `20` or `24`.
- `ApplicationsToMonitor` can watch a separate local app or helper by bundle ID on macOS.
- Elgato recommends modern plugins use `SDKVersion: 3` when preparing for Marketplace DRM.

### Native vs Node plugin strategy

- Elgato still documents a native-plugin WebSocket API for console apps written in languages like C++ or C#.
- Their own guidance says native plugins are an advanced technique and recommends using the Stream Deck SDK with Node.js native addons instead.
- For this project, that strongly favors a regular Node-based plugin action first, not a full native plugin entry point.
- The docs do not expose a special helper-launch API; because the backend runs in Node.js, invoking a child process is a reasonable implementation inference.

### macOS display sleep

- The documented macOS command-line mechanism for immediate display sleep is `pmset displaysleepnow`.
- The local `pmset(1)` man page on this machine explicitly says `displaysleepnow - causes display to go to sleep immediately`.
- `pmset` distinguishes `displaysleepnow` from `sleepnow`, which matters because the goal is display sleep without full system sleep.
- `caffeinate` and IOPM assertions are the inverse toolset: they prevent display or system sleep and are useful mostly for debugging or explaining why displays may wake immediately.

### Public API options vs non-options

- Public IOKit APIs expose `IOPMSleepSystem` for full system sleep, but there is no corresponding public API in the inspected headers for "sleep displays now".
- CoreGraphics event posting exists through `CGEvent` and macOS exposes `CGPreflightPostEventAccess` / `CGRequestPostEventAccess`, which indicates synthetic keypresses require special permission on modern macOS.
- Accessibility APIs such as `AXIsProcessTrustedWithOptions` further confirm that UI scripting / synthetic input approaches carry permission friction.
- Because the target behavior is already exposed by `pmset`, simulating `Ctrl` + `Shift` + `Eject` is a weaker option than calling the documented display-sleep command directly.

### Rejected approaches

- AppleScript / `System Events`: useful for wrapping shell commands, not for a first-class display-sleep implementation.
- Synthetic keyboard events: hardware-dependent, requires event-posting or accessibility permission, and does not improve on `pmset`.
- Private IOKit / IORegistry tricks around `IODisplayWrangler`: unsupported and not a good basis for a distributable plugin.

## Conclusions

- The shortest reliable path is a Node-based Stream Deck plugin action for macOS that executes `/usr/bin/pmset displaysleepnow`.
- A bundled native helper is optional, not required for the first version.
- A helper becomes justified only if direct child-process execution proves problematic in practice, or if we later want richer macOS-specific diagnostics and permission UX.

## Implementation status

- A Stream Deck plugin was scaffolded with Elgato's CLI and converted from the sample counter action into a macOS-only `turn-off-displays` action.
- The action backend now calls `/usr/bin/pmset displaysleepnow`.
- The full-color icon source of truth is now `assets/icons/sleep-icon.svg`, and the packaged Stream Deck key/plugin PNGs derive from that SVG.
- The monochrome action/category icons still use official Lucide glyphs and transparent PNG exports for the Stream Deck bundle.
- The repo now includes Maker Console submission assets, including a generated app icon and a thumbnail under `assets/marketplace/`.
- The repo also now includes three 1920×960 gallery images plus editable HTML/CSS source files for future marketing-asset revisions.
- The plugin validates successfully with `streamdeck validate`.
- A distributable package was created successfully with `streamdeck pack`.
- The plugin was linked into the local Stream Deck installation, tested successfully on actual hardware, and submitted to Maker Console for Marketplace review.

## Remaining human publication steps

- Wait for Marketplace review feedback in Maker Console.
- If review requests changes, update the package assets or metadata and resubmit.
- After approval, confirm the public listing metadata and support contact look correct on the live Marketplace page.

## Source Notes

### Local machine references

- `man pmset`
- `man caffeinate`
- `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX26.2.sdk/System/Library/Frameworks/IOKit.framework/Headers/pwr_mgt/IOPMLib.h`
- `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX26.2.sdk/System/Library/Frameworks/CoreGraphics.framework/Versions/A/Headers/CGEvent.h`
- `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX26.2.sdk/System/Library/Frameworks/ApplicationServices.framework/Versions/A/Frameworks/HIServices.framework/Versions/A/Headers/AXUIElement.h`

### Web references

- Stream Deck plugin environment: <https://docs.elgato.com/streamdeck/sdk/introduction/plugin-environment/>
- Stream Deck getting started: <https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/>
- Stream Deck manifest reference: <https://docs.elgato.com/streamdeck/sdk/references/manifest/>
- Stream Deck CLI intro: <https://docs.elgato.com/streamdeck/cli/intro/>
- Stream Deck distribution: <https://docs.elgato.com/streamdeck/sdk/introduction/distribution/>
- Stream Deck native plugin WebSocket reference: <https://docs.elgato.com/streamdeck/sdk/references/websocket/plugin/>
- Official `pmset` man page mirror: <https://keith.github.io/xcode-man-pages/pmset.1.html>
- Apple power efficiency guidance: <https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/PrioritizeWorkAtTheAppLevel.html>
- Apple macOS automation/UI scripting guidance: <https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/AutomatetheUserInterface.html>
