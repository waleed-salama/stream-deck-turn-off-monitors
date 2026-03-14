import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { describeExecFileError, runDisplaySleep } from "../lib/run-display-sleep";

/**
 * Persisted per-action settings stored by Stream Deck.
 *
 * The action itself is stateless at runtime, so these fields exist mainly to
 * preserve the last execution result for debugging when a user inspects the
 * action instance in the Stream Deck app.
 */
type DisplaySleepSettings = {
	lastRunAt?: string;
	lastStatus?: "ok" | "error";
	lastError?: string;
};

/**
 * Stream Deck action that immediately sleeps all connected displays on macOS.
 *
 * This action intentionally delegates the actual system behavior to
 * `/usr/bin/pmset displaysleepnow`, which is the documented display-sleep
 * command on macOS. The Stream Deck side only handles user interaction,
 * logging, and lightweight success/error feedback.
 */
@action({ UUID: "com.waleed-salama.turn-off-displays.sleep-displays" })
export class TurnOffDisplays extends SingletonAction<DisplaySleepSettings> {
	/**
	 * Clears any dynamic title when the action becomes visible.
	 *
	 * The packaged PNG key art is the source of truth for the button look, so
	 * the action avoids overlaying text on top of that image at runtime.
	 */
	override async onWillAppear(ev: WillAppearEvent<DisplaySleepSettings>): Promise<void> {
		await ev.action.setTitle("");
	}

	/**
	 * Handles the Stream Deck key press.
	 *
	 * On success, the action stores a timestamped "ok" result and briefly shows
	 * Stream Deck's built-in success indicator. On failure, it stores a compact
	 * error message and shows the built-in alert state so the user gets visible
	 * feedback on the device.
	 *
	 * @param ev Key press event emitted by Stream Deck for this action instance.
	 */
	override async onKeyDown(ev: KeyDownEvent<DisplaySleepSettings>): Promise<void> {
		streamDeck.logger.info("Executing /usr/bin/pmset displaysleepnow");

		try {
			const result = await runDisplaySleep();
			const settings: DisplaySleepSettings = {
				...ev.payload.settings,
				lastRunAt: new Date().toISOString(),
				lastStatus: "ok",
				lastError: undefined,
			};

			await ev.action.setSettings(settings);
			await ev.action.showOk();

			if (result.stderr.trim().length > 0) {
				streamDeck.logger.warn(`pmset wrote to stderr: ${result.stderr.trim()}`);
			}
		} catch (error) {
			const message = describeExecFileError(error);
			const settings: DisplaySleepSettings = {
				...ev.payload.settings,
				lastRunAt: new Date().toISOString(),
				lastStatus: "error",
				lastError: message,
			};

			streamDeck.logger.error(`Failed to sleep displays: ${message}`);
			await ev.action.setSettings(settings);
			await ev.action.showAlert();
		}
	}
}
