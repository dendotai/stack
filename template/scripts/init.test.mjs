import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Git must not read the developer's own config: identity, signing and hooks
// would otherwise leak into the throwaway repos, and a missing identity would
// fail the commit.
const gitConfig = join(mkdtempSync(join(tmpdir(), "init-gitconfig-")), "config");
writeFileSync(gitConfig, "[user]\n\tname = Ada\n\temail = ada@example.com\n");
const env = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: "1" };

// A small tree with the placeholders the script rewrites, plus one file it
// leaves alone. Built rather than copied from the surrounding project, so the
// tests also pass in a project that already ran the script.
const WRANGLER = "apps/web/wrangler.jsonc";
const FIXTURE = {
  "package.json": '{\n  "name": "stack",\n  "dependencies": { "@stack/api": "workspace:*" }\n}\n',
  [WRANGLER]:
    '{\n  "name": "stack",\n  "env": {\n    "dev": { "name": "stack-dev", "routes": [{ "pattern": "dev.stack.example" }] },\n    "prod": { "name": "stack-prod", "routes": [{ "pattern": "stack.example" }] }\n  }\n}\n',
  "apps/web/src/routes/index.tsx": "export const Route = null;\n",
  "apps/web/.dev.vars.example": "TEST_USER_EMAIL=\n",
  ".gitignore": ".dev.vars\n",
};

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "init-test-"));
  for (const [path, text] of Object.entries(FIXTURE)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  mkdirSync(join(dir, "scripts"));
  copyFileSync(join(import.meta.dir, "init.mjs"), join(dir, "scripts/init.mjs"));
  return dir;
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
}

function init(cwd, ...args) {
  const result = spawnSync(process.execPath, ["scripts/init.mjs", ...args], {
    cwd,
    env,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function withFixture(fn) {
  const dir = fixture();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withCommittedFixture(fn) {
  return withFixture((dir) => {
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Copy template");
    return fn(dir);
  });
}

describe("init.mjs commits the rewrite", () => {
  test("in a repo with history, the rewritten files become one commit", () => {
    withCommittedFixture((dir) => {
      const { status, stderr } = init(dir, "--name", "acme-com");

      expect(stderr).toBe("");
      expect(status).toBe(0);
      expect(git(dir, "status", "--porcelain")).toBe("");
      expect(git(dir, "log", "-1", "--format=%s")).toBe("Initialize from template: acme-com");
      expect(git(dir, "show", "--stat", "--format=", "HEAD")).toContain(WRANGLER);
      expect(init(dir, "--check").status).toBe(0);
    });
  });

  test("in a repo with history, unrelated local edits stay out of the commit", () => {
    withCommittedFixture((dir) => {
      writeFileSync(join(dir, "apps/web/src/routes/index.tsx"), "export const Route = 1;\n");
      writeFileSync(join(dir, "staged.txt"), "staged before init\n");
      git(dir, "add", "staged.txt");

      expect(init(dir, "--name", "acme-com").status).toBe(0);

      const committed = git(dir, "show", "--stat", "--format=", "HEAD");
      expect(committed).not.toContain("index.tsx");
      expect(committed).not.toContain("staged.txt");
      expect(git(dir, "diff", "--name-only")).toBe("apps/web/src/routes/index.tsx");
      expect(git(dir, "diff", "--cached", "--name-only")).toBe("staged.txt");
    });
  });

  test("inside a parent directory's repo, the rewrite lands but nothing is committed", () => {
    withFixture((parent) => {
      git(parent, "init", "-q");
      const dir = join(parent, "nested");
      mkdirSync(join(dir, "scripts"), { recursive: true });
      copyFileSync(join(parent, "package.json"), join(dir, "package.json"));
      copyFileSync(join(parent, "scripts/init.mjs"), join(dir, "scripts/init.mjs"));

      const { status, stderr } = init(dir, "--name", "acme-com");

      expect(status).toBe(1);
      expect(stderr).toContain("not this directory");
      expect(git(parent, "status", "--porcelain")).toContain("?? nested/");
      expect(readFileSync(join(dir, "package.json"), "utf8")).toContain('"name": "acme-com"');
    });
  });

  test("on an unborn branch, the whole tree becomes the first commit", () => {
    withFixture((dir) => {
      git(dir, "init", "-q");

      const { status } = init(dir, "--name", "acme-com");

      expect(status).toBe(0);
      expect(git(dir, "status", "--porcelain")).toBe("");
      const tracked = git(dir, "ls-files").split("\n");
      expect(tracked).toContain("apps/web/src/routes/index.tsx");
      expect(tracked).not.toContain("apps/web/.dev.vars");
    });
  });

  test("--dry-run commits nothing", () => {
    withCommittedFixture((dir) => {
      const before = git(dir, "rev-parse", "HEAD");

      const { status } = init(dir, "--name", "acme-com", "--dry-run");

      expect(status).toBe(0);
      expect(git(dir, "rev-parse", "HEAD")).toBe(before);
      expect(git(dir, "status", "--porcelain")).toBe("");
    });
  });

  test("--no-commit leaves the rewrite in the working tree and warns", () => {
    withCommittedFixture((dir) => {
      const { status, stderr } = init(dir, "--name", "acme-com", "--no-commit");

      expect(status).toBe(0);
      expect(git(dir, "log", "-1", "--format=%s")).toBe("Copy template");
      expect(git(dir, "status", "--porcelain")).toContain(WRANGLER);
      expect(stderr).toContain("not committed");
      expect(stderr).toContain('git commit -m "Initialize from template: acme-com"');
    });
  });

  test("outside a git repository, the rewrite lands but the script fails loudly", () => {
    withFixture((dir) => {
      const { status, stderr } = init(dir, "--name", "acme-com");

      expect(status).toBe(1);
      expect(stderr).toContain("not a git repository");
      expect(stderr).toContain("git init");
      expect(readFileSync(join(dir, "package.json"), "utf8")).toContain('"name": "acme-com"');
    });
  });
});

describe("init.mjs --check", () => {
  test("fails on the unrenamed tree and names the placeholder files", () => {
    withFixture((dir) => {
      const { status, stderr } = init(dir, "--check");

      expect(status).toBe(1);
      expect(stderr).toContain(`${WRANGLER}: stack.example`);
      expect(stderr).not.toContain("index.tsx");
    });
  });

  test("fails on a half-rewritten tree", () => {
    withFixture((dir) => {
      expect(init(dir, "--name", "acme-com", "--no-commit").status).toBe(0);
      expect(init(dir, "--check").status).toBe(0);

      writeFileSync(join(dir, WRANGLER), FIXTURE[WRANGLER]);

      const { status, stderr } = init(dir, "--check");
      expect(status).toBe(1);
      expect(stderr).toContain(WRANGLER);
      expect(stderr).not.toContain("package.json");
    });
  });
});
