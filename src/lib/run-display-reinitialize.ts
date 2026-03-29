import { spawn } from "node:child_process";

import type { CommandResult } from "./run-display-sleep";

export const DEFAULT_BETTERDISPLAY_PATH = "/Applications/BetterDisplay.app/Contents/MacOS/BetterDisplay";

export type BetterDisplayDisplay = {
	name: string;
	tagId: string;
	originalName?: string;
	productName?: string;
};

type BetterDisplayIdentifier = {
	deviceType?: string;
	name?: string;
	tagID?: string;
	originalName?: string;
	productName?: string;
};

export async function listBetterDisplayDisplays(
	betterDisplayPath: string = DEFAULT_BETTERDISPLAY_PATH,
): Promise<BetterDisplayDisplay[]> {
	ensureMacOS();
	const result = await runBetterDisplayCommand(betterDisplayPath, ["get", "-identifiers"]);
	const identifiers = parseIdentifierOutput(result.stdout);

	return identifiers
		.filter((item) => item.deviceType === "Display" && typeof item.name === "string" && typeof item.tagID === "string")
		.map((item) => ({
			name: item.name as string,
			tagId: item.tagID as string,
			originalName: typeof item.originalName === "string" ? item.originalName : undefined,
			productName: typeof item.productName === "string" ? item.productName : undefined,
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

export async function runDisplayReinitialize(
	betterDisplayPath: string,
	displayTagId: string,
): Promise<CommandResult> {
	ensureMacOS();

	if (displayTagId.trim().length === 0) {
		throw new Error("A BetterDisplay tagID is required.");
	}

	return runBetterDisplayCommand(betterDisplayPath, ["perform", `-tagID=${displayTagId.trim()}`, "-reinitialize"]);
}

export function describeBetterDisplayError(error: unknown): string {
	if (typeof error === "object" && error !== null) {
		const commandError = error as {
			message?: string;
			code?: number | string | null;
			signal?: NodeJS.Signals | null;
			stderr?: string;
		};
		const details = [
			commandError.message,
			commandError.code !== undefined ? `code=${String(commandError.code)}` : undefined,
			commandError.signal !== undefined ? `signal=${commandError.signal}` : undefined,
			commandError.stderr?.trim() || undefined,
		].filter(Boolean);

		if (details.length > 0) {
			return details.join(" | ");
		}
	}

	return error instanceof Error ? error.message : String(error);
}

async function runBetterDisplayCommand(betterDisplayPath: string, args: string[]): Promise<CommandResult> {
	const executablePath = betterDisplayPath.trim() || DEFAULT_BETTERDISPLAY_PATH;

	return new Promise<CommandResult>((resolve, reject) => {
		const child = spawn(executablePath, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr?.on("data", (chunk: string) => {
			stderr += chunk;
		});

		child.on("error", reject);
		child.on("close", (code, signal) => {
			if (code === 0) {
				resolve({ stdout, stderr });
				return;
			}

			reject(
				Object.assign(new Error("BetterDisplay command failed."), {
					code,
					signal,
					stdout,
					stderr,
				}),
			);
		});
	});
}

function parseIdentifierOutput(stdout: string): BetterDisplayIdentifier[] {
	const trimmed = stdout.trim();

	if (trimmed.length === 0) {
		return [];
	}

	const parsed = JSON.parse(trimmed.startsWith("[") ? trimmed : `[${trimmed}]`);
	if (!Array.isArray(parsed)) {
		throw new Error("BetterDisplay returned an unexpected identifiers payload.");
	}

	return parsed as BetterDisplayIdentifier[];
}

function ensureMacOS(): void {
	if (process.platform !== "darwin") {
		throw new Error(`This action only supports macOS. Current platform: ${process.platform}`);
	}
}
