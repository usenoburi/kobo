#!/usr/bin/env node
// Writes one version into every file the desktop app reads it from. Used by the release workflow,
// which computes the version from the last tag: the version in the repository is not the source.
// Usage: node scripts/set-version.mjs 0.1.1
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: node scripts/set-version.mjs <major.minor.patch>");
  process.exit(1);
}

const root = new URL("../", import.meta.url);
const edit = (path, change) => {
  const file = fileURLToPath(new URL(path, root));
  const before = readFileSync(file, "utf8");
  const after = change(before);
  if (after === before) throw new Error(`No version found in ${path}`);
  writeFileSync(file, after);
};

edit("apps/desktop/src-tauri/tauri.conf.json", (s) =>
  s.replace(/"version": "[^"]+"/, `"version": "${version}"`),
);
edit("apps/desktop/package.json", (s) =>
  s.replace(/"version": "[^"]+"/, `"version": "${version}"`),
);
edit("apps/desktop/src-tauri/Cargo.toml", (s) =>
  s.replace(/^version = "[^"]+"/m, `version = "${version}"`),
);
edit("apps/desktop/src-tauri/Cargo.lock", (s) =>
  s.replace(/(name = "kobo-desktop"\nversion = )"[^"]+"/, `$1"${version}"`),
);
console.log(`Version set to ${version}`);
