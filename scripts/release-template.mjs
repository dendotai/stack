#!/usr/bin/env bun
// Cuts a template release: folds `.changelog/` into a new version section of
// `template/TEMPLATE_CHANGELOG.md`, bumps `template/VERSION`, and empties the
// directory.
//
// `.changelog/` *is* the Unreleased section — one file per entry, so two open
// pull requests never edit the same line (the conflict this replaced).
//
//   bun scripts/release-template.mjs 1.1.0 [--date 2026-09-12] [--dry-run]

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENTRIES_DIR = join(ROOT, ".changelog");
const CHANGELOG = join(ROOT, "template/TEMPLATE_CHANGELOG.md");
const VERSION_FILE = join(ROOT, "template/VERSION");

function fail(message) {
  console.error(`release-template: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
let version;
let date = new Date().toISOString().slice(0, 10);
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--dry-run") dryRun = true;
  else if (arg === "--date") date = args[++i];
  else if (arg.startsWith("--")) fail(`unknown flag ${arg}`);
  else if (version === undefined) version = arg;
  else fail(`unexpected argument ${arg}`);
}

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail("give the new version as X.Y.Z — e.g. `bun scripts/release-template.mjs 1.1.0`");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`--date must be YYYY-MM-DD, got ${date}`);

const current = readFileSync(VERSION_FILE, "utf8").trim();
const parts = (v) => v.split(".").map(Number);
const compare = (a, b) => parts(a).findIndex((n, i) => n !== parts(b)[i]);
const firstDifference = compare(version, current);
if (firstDifference === -1 || parts(version)[firstDifference] < parts(current)[firstDifference]) {
  fail(`${version} is not newer than the current ${current}`);
}

const files = readdirSync(ENTRIES_DIR).filter((name) => name.endsWith(".md"));
if (files.length === 0) fail(`${ENTRIES_DIR} holds no entries — nothing to release`);

// The changelog reads newest first, and an agent applying a version's entries
// works up from the oldest. History order — not the commit timestamp — gives
// that: two entries committed in the same second still have an order here.
// A file no commit has added yet is the newest there is.
const history = execFileSync(
  "git",
  ["log", "--diff-filter=A", "--name-only", "--format=", "--", ".changelog"],
  { cwd: ROOT, encoding: "utf8" },
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const ordered = files
  .map((name) => ({ name, rank: history.indexOf(join(".changelog", name)) }))
  .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

const entries = ordered.map(({ name }) =>
  readFileSync(join(ENTRIES_DIR, name), "utf8").replace(/\s+$/, ""),
);
const section = `## [${version}] — ${date}\n\n${entries.join("\n\n")}\n`;

const lines = readFileSync(CHANGELOG, "utf8").split("\n");
const unreleased = lines.findIndex((line) => line.startsWith("## [Unreleased]"));
if (unreleased === -1) fail(`no "## [Unreleased]" heading in ${CHANGELOG}`);
const insertAt = lines.findIndex((line, i) => i > unreleased && line.startsWith("## ["));
if (insertAt === -1) fail(`no released version heading after "## [Unreleased]" in ${CHANGELOG}`);

const updated = [...lines.slice(0, insertAt), section, ...lines.slice(insertAt)].join("\n");

console.log(`Entries, newest first:\n${ordered.map(({ name }) => `  ${name}`).join("\n")}\n`);
if (dryRun) {
  console.log(section);
  console.log(`--dry-run: ${current} → ${version} not written.`);
  process.exit(0);
}

writeFileSync(CHANGELOG, updated);
writeFileSync(VERSION_FILE, `${version}\n`);
for (const { name } of ordered) rmSync(join(ENTRIES_DIR, name));

console.log(`Released ${version}. Review the diff, then commit.`);
