#!/usr/bin/env bun
// Fail when a `patchedDependencies` entry in package.json names a version that bun.lock no longer resolves.
//
//   bun scripts/check-patches.mjs
//
// `bun install` drops such a patch without a warning, `--frozen-lockfile` included, so a version bump removes a `bun patch` fix silently (https://github.com/oven-sh/bun/issues/40106). Delete this script and its CI jobs once bun reports the mismatch itself.

import { readFileSync } from "node:fs";

const patched = Object.keys(
  JSON.parse(readFileSync("package.json", "utf8")).patchedDependencies ?? {},
);
const { packages } = Bun.JSONC.parse(readFileSync("bun.lock", "utf8"));
// Each entry's first element is `<name>@<version>`; the entry's key is not the name for a nested copy (`parent/name`).
const resolved = new Set(Object.values(packages).map(([id]) => id));

const orphaned = patched.filter((key) => !resolved.has(key));
for (const key of orphaned) {
  const at = key.lastIndexOf("@");
  const name = key.slice(0, at);
  const versions = [...resolved]
    .filter((id) => id.lastIndexOf("@") === name.length && id.startsWith(name))
    .map((id) => id.slice(name.length + 1));
  console.error(
    `${name}: the patch is for ${key.slice(at + 1)}, but bun.lock resolves ${versions.join(", ") || "no version"}, so bun install skips the patch. Regenerate it with \`bun patch ${name}\`.`,
  );
}
if (orphaned.length) process.exit(1);
