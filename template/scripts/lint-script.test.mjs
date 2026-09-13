import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT_PACKAGE = JSON.parse(readFileSync(join(import.meta.dir, "../package.json"), "utf8"));

// The root `lint` script is run verbatim in a throwaway monorepo whose
// `biome` is a stub, so the test exercises the workspace fan-out and nothing
// else. Biome itself is covered by running it for real in CI.
function monorepo(workspaces) {
  const dir = mkdtempSync(join(tmpdir(), "lint-script-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "fixture",
      workspaces: ["apps/*"],
      scripts: { lint: ROOT_PACKAGE.scripts.lint },
    }),
  );
  const bin = join(dir, "node_modules/.bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "biome"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "biome"), 0o755);
  for (const [name, scripts] of Object.entries(workspaces)) {
    mkdirSync(join(dir, "apps", name), { recursive: true });
    writeFileSync(join(dir, "apps", name, "package.json"), JSON.stringify({ name, scripts }));
  }
  return dir;
}

function lint(workspaces) {
  const dir = monorepo(workspaces);
  try {
    return spawnSync(process.execPath, ["run", "lint"], { cwd: dir, encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("root lint script", () => {
  test("fails when a workspace's own lint script fails", () => {
    const result = lint({ a: { lint: "exit 3" }, b: { test: "true" } });
    expect(result.status).not.toBe(0);
  });

  test("passes when every workspace lint script passes", () => {
    const result = lint({ a: { lint: "true" }, b: { test: "true" } });
    expect(result.status).toBe(0);
  });

  test("passes when no workspace has a lint script", () => {
    const result = lint({ a: { test: "true" } });
    expect(result.status).toBe(0);
  });
});
