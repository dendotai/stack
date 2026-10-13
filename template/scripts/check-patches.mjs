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

// `lastIndexOf`, because a scoped name starts with `@` too.
const split = (id) => {
  const at = id.lastIndexOf("@");
  return { name: id.slice(0, at), version: id.slice(at + 1) };
};

const orphaned = patched.filter((key) => !resolved.has(key));
for (const key of orphaned) {
  const { name, version } = split(key);
  const versions = [...resolved]
    .map(split)
    .filter((id) => id.name === name)
    .map((id) => id.version);
  console.error(
    `${name}: the patch is for ${version}, but bun.lock resolves ${versions.join(", ") || "no version"}, so bun install skips the patch. The steps are in README.md, "Patched dependencies".`,
  );
}
if (orphaned.length) process.exit(1);
