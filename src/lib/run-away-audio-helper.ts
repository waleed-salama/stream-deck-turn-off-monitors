import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import type { CommandResult } from "./run-display-sleep";

const execFileAsync = promisify(execFile);
const HELPER_PATH = fileURLToPath(new URL("./away-audio-helper", import.meta.url));

/**
 * Captures the current output-audio state, stores it under the helper's
 * Application Support directory, and mutes the system output.
 */
export async function prepareAwayAudio(token: string): Promise<CommandResult> {
	return execHelper(["prepare-away", "--token", token]);
}

/**
 * Restores a previously captured audio state immediately and clears it.
 */
export async function restoreAwayAudioNow(token: string): Promise<CommandResult> {
	return execHelper(["restore-now", "--token", token]);
}

/**
 * Starts a detached watcher process that restores the saved audio state when
 * the user returns and the Mac becomes active again.
 */
export function startUnlockWatcher(token: string): void {
	const child = spawn(HELPER_PATH, ["watch-unlock", "--token", token], {
		detached: true,
		stdio: "ignore",
	});

	child.unref();
}

/**
 * Executes the bundled helper binary for synchronous subcommands.
 */
async function execHelper(args: string[]): Promise<CommandResult> {
	return execFileAsync(HELPER_PATH, args);
}
