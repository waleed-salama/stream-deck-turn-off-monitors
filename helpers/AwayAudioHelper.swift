import AppKit
import Foundation

private let pluginIdentifier = "com.waleed-salama.turn-off-displays"
private let stateFileName = "away-audio-state.json"
private let helperLogFileName = "away-audio-helper.log"
private let osaScriptPath = "/usr/bin/osascript"

/// Persisted audio snapshot that lets the helper restore the user's previous
/// output state after the session becomes active again.
private struct PendingAudioState: Codable {
    let token: String
    let outputVolume: Int
    let outputMuted: Bool
    let createdAt: Date
}

/// Minimal helper-specific error surface so both the plugin logs and manual
/// terminal invocations get readable failure messages.
private enum HelperError: LocalizedError {
    case usage(String)
    case commandFailed(String)
    case invalidOutput(String)

    var errorDescription: String? {
        switch self {
        case .usage(let message), .commandFailed(let message), .invalidOutput(let message):
            return message
        }
    }
}

/// Detached unlock watcher that restores the saved audio state only after the
/// user session has actually resigned and then become active again.
private final class UnlockWatcher {
    private let token: String
    private var sawSessionResign = false
    private var observers: [NSObjectProtocol] = []
    private var pollTimer: Timer?

    init(token: String) {
        self.token = token
    }

    func run() throws {
        guard currentState()?.token == token else {
            logHelper("watch-unlock exiting immediately because token \(token) is no longer pending")
            return
        }

        logHelper("watch-unlock started for token \(token)")

        let workspaceCenter = NSWorkspace.shared.notificationCenter
        let distributedCenter = DistributedNotificationCenter.default()

        observers.append(
            workspaceCenter.addObserver(
                forName: NSWorkspace.sessionDidResignActiveNotification,
                object: nil,
                queue: nil
            ) { [weak self] _ in
                logHelper("received NSWorkspace.sessionDidResignActiveNotification")
                self?.handleSessionResign()
            }
        )

        observers.append(
            workspaceCenter.addObserver(
                forName: NSWorkspace.sessionDidBecomeActiveNotification,
                object: nil,
                queue: nil
            ) { [weak self] _ in
                logHelper("received NSWorkspace.sessionDidBecomeActiveNotification")
                self?.handleSessionBecomeActive()
            }
        )

        observers.append(
            distributedCenter.addObserver(
                forName: Notification.Name("com.apple.screenIsLocked"),
                object: nil,
                queue: nil
            ) { [weak self] _ in
                logHelper("received com.apple.screenIsLocked")
                self?.handleSessionResign()
            }
        )

        observers.append(
            distributedCenter.addObserver(
                forName: Notification.Name("com.apple.screenIsUnlocked"),
                object: nil,
                queue: nil
            ) { [weak self] _ in
                logHelper("received com.apple.screenIsUnlocked")
                self?.handleSessionBecomeActive()
            }
        )

        pollTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.pollSessionState()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + .hours(12)) {
            logHelper("watch-unlock timing out after 12 hours")
            exit(0)
        }

        RunLoop.current.run()
    }

    private func pollSessionState() {
        guard currentState()?.token == token else {
            logHelper("watch-unlock stopping because token \(token) is no longer pending")
            exit(0)
        }

        let snapshot = currentSessionSnapshot()

        if snapshot.locked || !snapshot.onConsole {
            if !sawSessionResign {
                logHelper("detected locked session via polling (locked=\(snapshot.locked), onConsole=\(snapshot.onConsole))")
            }

            sawSessionResign = true
            return
        }

        if sawSessionResign {
            logHelper("detected unlocked session via polling")
            handleSessionBecomeActive()
        }
    }

    private func handleSessionResign() {
        guard currentState()?.token == token else {
            exit(0)
        }

        if !sawSessionResign {
            logHelper("marked token \(token) as having seen a session resign/lock transition")
        }

        sawSessionResign = true
    }

    private func handleSessionBecomeActive() {
        guard sawSessionResign else {
            logHelper("ignoring session active event because no prior lock was observed")
            return
        }

        guard let state = currentState(), state.token == token else {
            logHelper("session became active but pending state for token \(token) no longer exists")
            exit(0)
        }

        do {
            try restoreAudioState(state)
            try clearStateFile()
            logHelper("successfully restored audio state for token \(token)")
            exit(0)
        } catch {
            logHelper("failed to restore audio state for token \(token): \(error.localizedDescription)")
            fputs("away-audio-helper: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }
}

/// Dispatches the helper subcommands used by the Stream Deck backend.
private func run() throws {
    var args = CommandLine.arguments.dropFirst()
    guard let command = args.first else {
        throw HelperError.usage("missing command")
    }

    args = args.dropFirst()

    switch command {
    case "prepare-away":
        let token = try requireToken(args)
        try prepareAway(token: token)
    case "restore-now":
        let token = try requireToken(args)
        try restoreNow(token: token)
    case "watch-unlock":
        let token = try requireToken(args)
        let watcher = UnlockWatcher(token: token)
        try watcher.run()
    case "lock-session":
        try lockSession()
    default:
        throw HelperError.usage("unknown command: \(command)")
    }
}

/// Reads a required `--token` argument used to correlate helper processes with
/// the current pending away-state file.
private func requireToken(_ args: ArraySlice<String>) throws -> String {
    guard let index = args.firstIndex(of: "--token"), args.indices.contains(args.index(after: index)) else {
        throw HelperError.usage("missing required --token argument")
    }

    return args[args.index(after: index)]
}

/// Captures the current audio state, persists it, and mutes output immediately.
private func prepareAway(token: String) throws {
    let (outputVolume, outputMuted) = try readCurrentAudioState()
    let state = PendingAudioState(
        token: token,
        outputVolume: outputVolume,
        outputMuted: outputMuted,
        createdAt: Date()
    )

    try writeStateFile(state)
    logHelper("prepared away state for token \(token) (volume=\(outputVolume), muted=\(outputMuted))")
    _ = try runAppleScript([
        "set volume with output muted"
    ])
    logHelper("muted output for token \(token)")
}

/// Restores the previously captured audio state right away.
private func restoreNow(token: String) throws {
    guard let state = currentState(), state.token == token else {
        logHelper("restore-now skipped because token \(token) is not pending")
        return
    }

    try restoreAudioState(state)
    try clearStateFile()
    logHelper("restore-now succeeded for token \(token)")
}

/// Locks the current macOS session via the standard keyboard shortcut.
private func lockSession() throws {
    _ = try runAppleScript([
        "tell application \"System Events\" to key code 12 using {control down, command down}"
    ])
    logHelper("invoked lock-session shortcut")
}

/// Reads the current output volume and mute state using AppleScript.
private func readCurrentAudioState() throws -> (Int, Bool) {
    let output = try runAppleScript([
        "get volume settings"
    ])

    let parts = output
        .split(separator: ",", omittingEmptySubsequences: true)
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }

    guard
        let volumePart = parts.first(where: { $0.hasPrefix("output volume:") }),
        let mutedPart = parts.first(where: { $0.hasPrefix("output muted:") }),
        let volume = Int(volumePart.split(separator: ":", maxSplits: 1).last ?? "")
    else {
        throw HelperError.invalidOutput("unexpected volume settings output: \(output)")
    }

    let mutedValue = mutedPart.split(separator: ":", maxSplits: 1).last?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let muted = mutedValue.lowercased() == "true"
    return (volume, muted)
}

/// Applies a previously captured output volume and mute state.
private func restoreAudioState(_ state: PendingAudioState) throws {
    let clampedVolume = max(0, min(100, state.outputVolume))
    _ = try runAppleScript([
        "set volume output volume \(clampedVolume)",
        state.outputMuted ? "set volume with output muted" : "set volume without output muted"
    ])
    logHelper("applied restore state (volume=\(clampedVolume), muted=\(state.outputMuted)) for token \(state.token)")
}

/// Executes one or more AppleScript statements through `osascript`.
private func runAppleScript(_ lines: [String]) throws -> String {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: osaScriptPath)
    process.arguments = lines.flatMap { ["-e", $0] }

    let stdout = Pipe()
    let stderr = Pipe()
    process.standardOutput = stdout
    process.standardError = stderr

    try process.run()
    process.waitUntilExit()

    let stdoutText = String(decoding: stdout.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
    let stderrText = String(decoding: stderr.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)

    guard process.terminationStatus == 0 else {
        throw HelperError.commandFailed(stderrText.isEmpty ? stdoutText : stderrText)
    }

    return stdoutText.trimmingCharacters(in: .whitespacesAndNewlines)
}

/// Reads the currently pending away-state file if it exists and parses cleanly.
private func currentState() -> PendingAudioState? {
    do {
        let data = try Data(contentsOf: try stateFileURL())
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(PendingAudioState.self, from: data)
    } catch {
        logHelper("failed to decode pending state: \(error.localizedDescription)")
        return nil
    }
}

/// Writes the pending away-state file into the user's Application Support area.
private func writeStateFile(_ state: PendingAudioState) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    encoder.dateEncodingStrategy = .iso8601

    let fileURL = try stateFileURL()
    try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try encoder.encode(state).write(to: fileURL, options: .atomic)
}

/// Deletes the pending away-state file when it is no longer needed.
private func clearStateFile() throws {
    let fileURL = try stateFileURL()
    if FileManager.default.fileExists(atPath: fileURL.path()) {
        try FileManager.default.removeItem(at: fileURL)
    }
}

/// Resolves the helper-owned state file location under Application Support.
private func stateFileURL() throws -> URL {
    guard let supportDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
        throw HelperError.commandFailed("unable to resolve Application Support directory")
    }

    return supportDirectory
        .appendingPathComponent(pluginIdentifier, isDirectory: true)
        .appendingPathComponent(stateFileName, isDirectory: false)
}

private func helperLogFileURL() throws -> URL {
    guard let supportDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
        throw HelperError.commandFailed("unable to resolve Application Support directory")
    }

    return supportDirectory
        .appendingPathComponent(pluginIdentifier, isDirectory: true)
        .appendingPathComponent(helperLogFileName, isDirectory: false)
}

private func currentSessionSnapshot() -> (locked: Bool, onConsole: Bool) {
    guard let session = CGSessionCopyCurrentDictionary() as? [String: Any] else {
        return (locked: false, onConsole: true)
    }

    let locked = sessionFlag(session["CGSSessionScreenIsLocked"]) || sessionFlag(session["CGSSessionScreenIsLockedKey"])
    let onConsole = sessionFlag(session["kCGSSessionOnConsoleKey"], defaultValue: true)
    return (locked: locked, onConsole: onConsole)
}

private func sessionFlag(_ value: Any?, defaultValue: Bool = false) -> Bool {
    switch value {
    case let boolValue as Bool:
        return boolValue
    case let number as NSNumber:
        return number.boolValue
    case let intValue as Int:
        return intValue != 0
    case let stringValue as String:
        return NSString(string: stringValue).boolValue
    default:
        return defaultValue
    }
}

private func logHelper(_ message: String) {
    let timestamp = ISO8601DateFormatter().string(from: Date())
    let line = "\(timestamp) \(message)\n"

    guard let data = line.data(using: .utf8) else {
        return
    }

    do {
        let fileURL = try helperLogFileURL()
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)

        if FileManager.default.fileExists(atPath: fileURL.path()) {
            let handle = try FileHandle(forWritingTo: fileURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
        } else {
            try data.write(to: fileURL, options: .atomic)
        }
    } catch {
        fputs("away-audio-helper log failure: \(error.localizedDescription)\n", stderr)
    }
}

private extension DispatchTimeInterval {
    static func hours(_ value: Int) -> DispatchTimeInterval {
        .seconds(value * 60 * 60)
    }
}

do {
    try run()
} catch {
    fputs("away-audio-helper: \(error.localizedDescription)\n", stderr)
    exit(1)
}
