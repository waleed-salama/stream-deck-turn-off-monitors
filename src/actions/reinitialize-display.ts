import streamDeck, {
	action,
	KeyDownEvent,
	PropertyInspectorDidAppearEvent,
	SendToPluginEvent,
	SingletonAction,
	WillAppearEvent,
} from "@elgato/streamdeck";

import {
	type BetterDisplayDisplay,
	DEFAULT_BETTERDISPLAY_PATH,
	describeBetterDisplayError,
	listBetterDisplayDisplays,
	runDisplayReinitialize,
} from "../lib/run-display-reinitialize";

type ReinitializeDisplaySettings = {
	betterDisplayPath?: string;
	selectedDisplayTagIds?: string[];
	lastRunAt?: string;
	lastStatus?: "ok" | "error";
	lastError?: string;
};

type ResolvedReinitializeDisplaySettings = ReinitializeDisplaySettings & {
	betterDisplayPath: string;
	selectedDisplayTagIds: string[];
};

type PropertyInspectorRequest = {
	type: "scan-displays";
	betterDisplayPath?: string;
};

type PropertyInspectorResponse = {
	type: "display-scan-result";
	displays: BetterDisplayDisplay[];
	error?: string;
};

@action({ UUID: "com.waleed-salama.turn-off-displays.reinitialize-display" })
export class ReinitializeDisplay extends SingletonAction<ReinitializeDisplaySettings> {
	override async onWillAppear(ev: WillAppearEvent<ReinitializeDisplaySettings>): Promise<void> {
		await ev.action.setTitle("");

		const normalized = normalizeSettings(ev.payload.settings);
		if (hasSettingsDrift(ev.payload.settings, normalized)) {
			await ev.action.setSettings(normalized);
		}
	}

	override async onPropertyInspectorDidAppear(
		ev: PropertyInspectorDidAppearEvent<ReinitializeDisplaySettings>,
	): Promise<void> {
		const currentSettings = await ev.action.getSettings<ReinitializeDisplaySettings>();
		const normalized = normalizeSettings(currentSettings);

		if (hasSettingsDrift(currentSettings, normalized)) {
			await ev.action.setSettings(normalized);
		}

		await this.pushDisplayScan(normalized.betterDisplayPath);
	}

	override async onSendToPlugin(
		ev: SendToPluginEvent<PropertyInspectorRequest, ReinitializeDisplaySettings>,
	): Promise<void> {
		if (ev.payload?.type !== "scan-displays") {
			return;
		}

		const betterDisplayPath =
			typeof ev.payload.betterDisplayPath === "string" && ev.payload.betterDisplayPath.trim().length > 0
				? ev.payload.betterDisplayPath.trim()
				: DEFAULT_BETTERDISPLAY_PATH;

		await this.pushDisplayScan(betterDisplayPath);
	}

	override async onKeyDown(ev: KeyDownEvent<ReinitializeDisplaySettings>): Promise<void> {
		const settings = normalizeSettings(ev.payload.settings);

		try {
			if (settings.selectedDisplayTagIds.length === 0) {
				throw new Error("Select at least one display in the Reinitialize Display inspector.");
			}

			const availableDisplays = await listBetterDisplayDisplays(settings.betterDisplayPath);
			const matchingDisplays = availableDisplays.filter((display) => settings.selectedDisplayTagIds.includes(display.tagId));

			if (matchingDisplays.length === 0) {
				throw new Error("None of the selected BetterDisplay tagIDs are currently available.");
			}

			streamDeck.logger.info(
				`Reinitializing BetterDisplay tagIDs: ${matchingDisplays.map((display) => `${display.name}(${display.tagId})`).join(", ")}`,
			);

			for (const display of matchingDisplays) {
				const result = await runDisplayReinitialize(settings.betterDisplayPath, display.tagId);

				if (result.stderr.trim().length > 0) {
					streamDeck.logger.warn(`BetterDisplay wrote to stderr for ${display.name}: ${result.stderr.trim()}`);
				}
			}

			const nextSettings: ReinitializeDisplaySettings = {
				...settings,
				lastRunAt: new Date().toISOString(),
				lastStatus: "ok",
				lastError: undefined,
			};

			await ev.action.setSettings(nextSettings);
			await ev.action.showOk();
		} catch (error) {
			const message = describeBetterDisplayError(error);
			const nextSettings: ReinitializeDisplaySettings = {
				...settings,
				lastRunAt: new Date().toISOString(),
				lastStatus: "error",
				lastError: message,
			};

			streamDeck.logger.error(`Failed to reinitialize BetterDisplay display(s): ${message}`);
			await ev.action.setSettings(nextSettings);
			await ev.action.showAlert();
		}
	}

	private async pushDisplayScan(betterDisplayPath: string): Promise<void> {
		try {
			const displays = await listBetterDisplayDisplays(betterDisplayPath);
			await streamDeck.ui.sendToPropertyInspector({
				type: "display-scan-result",
				displays,
			} satisfies PropertyInspectorResponse);
		} catch (error) {
			const message = describeBetterDisplayError(error);
			await streamDeck.ui.sendToPropertyInspector({
				type: "display-scan-result",
				displays: [],
				error: message,
			} satisfies PropertyInspectorResponse);
		}
	}
}

function normalizeSettings(settings: ReinitializeDisplaySettings): ResolvedReinitializeDisplaySettings {
	return {
		...settings,
		betterDisplayPath: settings.betterDisplayPath?.trim() || DEFAULT_BETTERDISPLAY_PATH,
		selectedDisplayTagIds: Array.isArray(settings.selectedDisplayTagIds)
			? settings.selectedDisplayTagIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
			: [],
	};
}

function hasSettingsDrift(
	current: ReinitializeDisplaySettings,
	normalized: ResolvedReinitializeDisplaySettings,
): boolean {
	const currentSelectedDisplayTagIds = Array.isArray(current.selectedDisplayTagIds)
		? current.selectedDisplayTagIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
		: [];

	return (
		current.betterDisplayPath !== normalized.betterDisplayPath ||
		currentSelectedDisplayTagIds.length !== normalized.selectedDisplayTagIds.length ||
		currentSelectedDisplayTagIds.some((value, index) => value !== normalized.selectedDisplayTagIds[index])
	);
}
