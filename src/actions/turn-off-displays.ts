import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

import { describeExecFileError, runDisplaySleep } from "../lib/run-display-sleep";

type DisplaySleepSettings = {
	lastRunAt?: string;
	lastStatus?: "ok" | "error";
	lastError?: string;
};

@action({ UUID: "com.waleed-salama.turn-off-displays.sleep-displays" })
export class TurnOffDisplays extends SingletonAction<DisplaySleepSettings> {
	override async onWillAppear(ev: WillAppearEvent<DisplaySleepSettings>): Promise<void> {
		await ev.action.setTitle("");
	}

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
