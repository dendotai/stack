import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A bun.lock in the text format bun writes: JSONC with trailing commas, each package as `[id, registry, info, integrity]`.
function lock(packages) {
  const lines = Object.entries(packages).map(
    ([key, id]) => `    "${key}": ["${id}", "", {}, "sha512-x"],\n`,
  );
  return `{\n  "lockfileVersion": 1,\n  "packages": {\n${lines.join("")}  },\n}\n`;
}

function check({ patchedDependencies, packages }) {
  const dir = mkdtempSync(join(tmpdir(), "check-patches-test-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "acme-com", patchedDependencies }),
  );
  writeFileSync(join(dir, "bun.lock"), lock(packages));
  mkdirSync(join(dir, "scripts"));
  copyFileSync(join(import.meta.dir, "check-patches.mjs"), join(dir, "scripts/check-patches.mjs"));
  const run = spawnSync("bun", ["scripts/check-patches.mjs"], { cwd: dir, encoding: "utf8" });
  rmSync(dir, { recursive: true });
  return { status: run.status, output: run.stdout + run.stderr };
}

describe("check-patches", () => {
  test("passes silently with no patchedDependencies", () => {
    expect(check({ packages: { "left-pad": "left-pad@1.3.0" } })).toEqual({
      status: 0,
      output: "",
    });
  });

  test("passes when bun.lock resolves the patched version", () => {
    const result = check({
      patchedDependencies: { "@scope/pkg@1.2.3": "patches/@scope%2Fpkg@1.2.3.patch" },
      packages: { "@scope/pkg": "@scope/pkg@1.2.3" },
    });
    expect(result).toEqual({ status: 0, output: "" });
  });

  test("passes when the patched version is resolved only as a nested copy", () => {
    const result = check({
      patchedDependencies: { "@scope/pkg@1.2.3": "patches/@scope%2Fpkg@1.2.3.patch" },
      packages: { "@scope/pkg": "@scope/pkg@2.0.0", "acme-ui/@scope/pkg": "@scope/pkg@1.2.3" },
    });
    expect(result).toEqual({ status: 0, output: "" });
  });

  test("fails, naming the package and both versions, when a bump moved the package off the patched version", () => {
    const result = check({
      patchedDependencies: { "@scope/pkg@1.2.3": "patches/@scope%2Fpkg@1.2.3.patch" },
      packages: { "@scope/pkg": "@scope/pkg@1.3.0" },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("@scope/pkg");
    expect(result.output).toContain("1.2.3");
    expect(result.output).toContain("1.3.0");
  });
});
