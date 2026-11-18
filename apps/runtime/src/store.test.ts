import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { defaultDatabasePath, legacyDatabasePath, migrateLegacyData } from "./store.ts";

describe("data location", () => {
  it("uses the Kōbō folder and keeps the old override variable working", () => {
    const xdg = { XDG_DATA_HOME: "/data" };
    expect(defaultDatabasePath(xdg, "linux")).toBe("/data/kobo/kobo.db");
    expect(legacyDatabasePath(xdg, "linux")).toBe("/data/noburi/noburi.db");
    expect(defaultDatabasePath({ NOBURI_DATA_DIR: "/x" }, "linux")).toBe("/x/kobo.db");
    expect(defaultDatabasePath({ KOBO_DATA_DIR: "/y", NOBURI_DATA_DIR: "/x" }, "linux")).toBe(
      "/y/kobo.db",
    );
  });
});

describe("migrateLegacyData", () => {
  it("moves the Noburi folder, clones included, and renames the database", () => {
    const root = mkdtempSync(join(tmpdir(), "kobo-migrate-"));
    const legacy = join(root, "noburi", "noburi.db");
    mkdirSync(join(root, "noburi", "repos", "owner-repo"), { recursive: true });
    writeFileSync(legacy, "db");
    writeFileSync(`${legacy}-wal`, "wal");
    const target = join(root, "kobo", "kobo.db");

    expect(migrateLegacyData(target, legacy)).toBe(true);
    expect(readFileSync(target, "utf8")).toBe("db");
    expect(readFileSync(`${target}-wal`, "utf8")).toBe("wal");
    expect(existsSync(join(root, "kobo", "repos", "owner-repo"))).toBe(true);
    expect(existsSync(join(root, "noburi"))).toBe(false);
  });

  it("renames the database in place when both live in the same folder", () => {
    const root = mkdtempSync(join(tmpdir(), "kobo-migrate-"));
    writeFileSync(join(root, "noburi.db"), "db");
    expect(migrateLegacyData(join(root, "kobo.db"), join(root, "noburi.db"))).toBe(true);
    expect(existsSync(join(root, "noburi.db"))).toBe(false);
  });

  it("never touches an existing Kōbō database", () => {
    const root = mkdtempSync(join(tmpdir(), "kobo-migrate-"));
    mkdirSync(join(root, "noburi"));
    mkdirSync(join(root, "kobo"));
    writeFileSync(join(root, "noburi", "noburi.db"), "old");
    writeFileSync(join(root, "kobo", "kobo.db"), "new");
    expect(
      migrateLegacyData(join(root, "kobo", "kobo.db"), join(root, "noburi", "noburi.db")),
    ).toBe(false);
    expect(readFileSync(join(root, "kobo", "kobo.db"), "utf8")).toBe("new");
    expect(existsSync(join(root, "noburi", "noburi.db"))).toBe(true);
  });
});
