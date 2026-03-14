import { execFile } from "node:child_process";
import type { ExecFileException } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PMSET_PATH = "/usr/bin/pmset";

export type CommandResult = {
	stdout: string;
	stderr: string;
};

export async function runDisplaySleep(): Promise<CommandResult> {
	ensureMacOS();
	return execFileAsync(PMSET_PATH, ["displaysleepnow"]);
}

export async function getPmsetAssertions(): Promise<CommandResult> {
	ensureMacOS();
	return execFileAsync(PMSET_PATH, ["-g", "assertions"]);
}

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

function ensureMacOS(): void {
	if (process.platform !== "darwin") {
		throw new Error(`This action only supports macOS. Current platform: ${process.platform}`);
	}
}
