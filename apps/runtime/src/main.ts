import { randomBytes } from "node:crypto";
import { findClaudeExecutable, runClaude, sdkSessionSource } from "@kobo/provider-claude";
import { dirname, join } from "node:path";
import { createApi } from "./api.ts";
import { GitHubForge, nodeExec } from "./forge.ts";
import { loginShellPath, mergePaths } from "./shellPath.ts";
import { MissionService } from "./missions.ts";
import { RunManager } from "./runs.ts";
import { createRuntimeServer, listenLoopback } from "./server.ts";
import { defaultDatabasePath, legacyDatabasePath, migrateLegacyData, Store } from "./store.ts";

const token = process.env.KOBO_RUNTIME_TOKEN ?? randomBytes(32).toString("base64url");
const port = Number(process.env.KOBO_RUNTIME_PORT ?? 0);
const allowedOrigins = (
  process.env.KOBO_ALLOWED_ORIGINS ??
  "http://localhost:1420,tauri://localhost,http://tauri.localhost"
).split(",");

const explicitDatabase = process.env.KOBO_DB ?? process.env.NOBURI_DB;
const databasePath = explicitDatabase ?? defaultDatabasePath();
// Installs from when the app was called Noburi keep their missions and clones.
if (!explicitDatabase && migrateLegacyData(databasePath, legacyDatabasePath())) {
  process.stderr.write(`Moved the Noburi data to ${databasePath}.\n`);
}
const store = new Store(databasePath);
// Nothing survives a restart as "running": interrupted work is shown as such, never resumed silently.
store.reconcileAfterRestart();
// Packaged builds do not ship the SDK's Claude binary: they run the user's installed Claude Code CLI.
const packaged = process.env.KOBO_PACKAGED === "1";
if (packaged) {
  // Launched from a desktop menu: give agents (and Claude detection) the user's real PATH.
  const shellPath = await loginShellPath();
  if (shellPath) process.env.PATH = mergePaths(shellPath, process.env.PATH ?? "");
  else
    process.stderr.write("Could not read the login shell PATH; agents get the launcher's PATH.\n");
}
const claudeExecutable = packaged || process.env.KOBO_CLAUDE_BIN ? findClaudeExecutable() : null;
if (packaged && !claudeExecutable) {
  process.stderr.write("Claude Code CLI not found: install it or set KOBO_CLAUDE_BIN.\n");
}
const runs = new RunManager((options) =>
  runClaude({ ...options, ...(claudeExecutable ? { executable: claudeExecutable } : {}) }),
);
const missions = { service: new MissionService(store, runs), store };
// Repositories agents work on are cloned next to the database, never into the user's own folders.
const forge = new GitHubForge(nodeExec, join(dirname(databasePath), "workspaces"));
const api = createApi({
  sessions: sdkSessionSource,
  runs,
  missions,
  forge,
  // What Studio shows: the CLI the user installed, even in development where the SDK's is used.
  connections: { exec: nodeExec, claudePath: claudeExecutable ?? findClaudeExecutable() },
});
const server = createRuntimeServer({ token, allowedOrigins, api });
const boundPort = await listenLoopback(server, port);

// The desktop shell reads this line from stdout to connect; the token is never logged elsewhere.
process.stdout.write(`${JSON.stringify({ event: "runtime.ready", port: boundPort, token })}\n`);

const shutdown = () => server.close(() => process.exit(0));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, shutdown);

// Set by the desktop shell: if it dies without stopping us, its pipe closes and we leave too.
if (process.env.KOBO_EXIT_ON_STDIN_CLOSE === "1") {
  process.stdin.on("end", shutdown);
  process.stdin.resume();
}
