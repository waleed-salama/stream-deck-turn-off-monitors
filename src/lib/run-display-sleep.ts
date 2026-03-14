import { execFile } from "node:child_process";
import type { ExecFileException } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PMSET_PATH = "/usr/bin/pmset";

/**
 * Normalized process result returned from `execFile`.
 *
 * Keeping the type small makes it easy to reuse for both the main display
 * sleep command and optional debugging commands such as `pmset -g assertions`.
 */
export type CommandResult = {
	stdout: string;
	stderr: string;
};

/**
 * Invokes macOS power management to immediately sleep all displays.
 *
 * This leaves the computer itself awake. The command maps directly to the
 * documented `pmset displaysleepnow` behavior.
 *
 * @returns Captured stdout/stderr from the underlying command.
 * @throws Error when called on a non-macOS platform or if `pmset` fails.
 */
export async function runDisplaySleep(): Promise<CommandResult> {
	ensureMacOS();
	return execFileAsync(PMSET_PATH, ["displaysleepnow"]);
}

/**
 * Reads the current macOS power assertions.
 *
 * This is not required for the normal action flow, but it is useful for
 * diagnostics when displays refuse to sleep or immediately wake again.
 *
 * @returns Captured stdout/stderr from `pmset -g assertions`.
 * @throws Error when called on a non-macOS platform or if `pmset` fails.
 */
export async function getPmsetAssertions(): Promise<CommandResult> {
	ensureMacOS();
	return execFileAsync(PMSET_PATH, ["-g", "assertions"]);
}

/**
 * Converts `execFile` failures into a compact loggable string.
 *
 * The child process error object may contain a mix of message, exit code,
 * signal, and stderr output. This helper keeps the logging call sites simple
 * while preserving the details most likely to help during troubleshooting.
 *
 * @param error Unknown thrown value from a failed command execution.
 * @returns Human-readable error details suitable for logs and persisted settings.
 */
export function describeExecFileError(error: unknown): string {
	if (typeof error === "object" && error !== null) {
		const execError = error as ExecFileException & { stderr?: string; stdout?: string };
		const details = [
			execError.message,
			execError.code !== undefined ? `code=${String(execError.code)}` : undefined,
			execError.signal !== undefined ? `signal=${execError.signal}` : undefined,
			execError.stderr?.trim() || undefined,
		].filter(Boolean);

		if (details.length > 0) {
			return details.join(" | ");
		}
	}

	return error instanceof Error ? error.message : String(error);
}

/**
 * Ensures the current process is running on macOS before calling `pmset`.
 *
 * The plugin manifest is already macOS-only, but this extra check keeps the
 * command helpers safe if they are ever reused from tests or other tooling.
 */
function ensureMacOS(): void {
	if (process.platform !== "darwin") {
		throw new Error(`This action only supports macOS. Current platform: ${process.platform}`);
	}
}
