import streamDeck, {
	action,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
} from "@elgato/streamdeck";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { prepareAwayAudio, restoreAwayAudioNow, startUnlockWatcher } from "../lib/run-away-audio-helper";
import { describeExecFileError, runDisplaySleep } from "../lib/run-display-sleep";

/**
 * Persisted per-action settings stored by Stream Deck.
 *
 * The action itself is stateless at runtime, so these fields exist mainly to
 * preserve the last execution result for debugging when a user inspects the
 * action instance in the Stream Deck app.
 */
type DisplaySleepSettings = {
	manageAudioWhileAway?: boolean;
	manageAudioWhileLocked?: boolean;
	lastRunAt?: string;
	lastStatus?: "ok" | "error";
	lastError?: string;
};

type ResolvedDisplaySleepSettings = DisplaySleepSettings & {
	manageAudioWhileAway: boolean;
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

		const normalized = normalizeSettings(ev.payload.settings);
		if (hasSettingsDrift(ev.payload.settings, normalized)) {
			await ev.action.setSettings(normalized);
		}
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
		const settings = normalizeSettings(ev.payload.settings);
		const shouldManageAudio = settings.manageAudioWhileAway;
		let audioToken: string | undefined;

		streamDeck.logger.info(`Executing away workflow (displaySleep=true, manageAudioWhileAway=${shouldManageAudio})`);

		try {
			if (shouldManageAudio) {
				audioToken = randomUUID();
				const result = await prepareAwayAudio(audioToken);

				if (result.stderr.trim().length > 0) {
					streamDeck.logger.warn(`prepare-away wrote to stderr: ${result.stderr.trim()}`);
				}

				startUnlockWatcher(audioToken);
				await delay(150);
			}

			const result = await runDisplaySleep();

			const nextSettings: DisplaySleepSettings = {
				...settings,
				lastRunAt: new Date().toISOString(),
				lastStatus: "ok",
				lastError: undefined,
			};

			await ev.action.setSettings(nextSettings);
			await ev.action.showOk();

			if (result.stderr.trim().length > 0) {
				streamDeck.logger.warn(`pmset wrote to stderr: ${result.stderr.trim()}`);
			}
		} catch (error) {
			const message = describeExecFileError(error);

			if (audioToken) {
				try {
					await restoreAwayAudioNow(audioToken);
				} catch (restoreError) {
					streamDeck.logger.error(`Failed to roll back audio state: ${describeExecFileError(restoreError)}`);
				}
			}

			const nextSettings: DisplaySleepSettings = {
				...settings,
				lastRunAt: new Date().toISOString(),
				lastStatus: "error",
				lastError: message,
			};

			streamDeck.logger.error(`Failed to sleep displays: ${message}`);
			await ev.action.setSettings(nextSettings);
			await ev.action.showAlert();
		}
	}
}

function normalizeSettings(settings: DisplaySleepSettings): ResolvedDisplaySleepSettings {
	const manageAudioWhileAway = settings.manageAudioWhileAway === true || settings.manageAudioWhileLocked === true;

	return {
		...settings,
		manageAudioWhileAway,
		manageAudioWhileLocked: undefined,
	};
}

function hasSettingsDrift(current: DisplaySleepSettings, normalized: ResolvedDisplaySleepSettings): boolean {
	return (
		current.manageAudioWhileAway !== normalized.manageAudioWhileAway ||
		current.manageAudioWhileLocked !== normalized.manageAudioWhileLocked
	);
}
