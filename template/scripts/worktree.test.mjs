import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";

const gitConfig = join(mkdtempSync(join(tmpdir(), "worktree-gitconfig-")), "config");
writeFileSync(gitConfig, "[user]\n\tname = Ada\n\temail = ada@example.com\n");

const SLUGS = { team: "acme", project: "acme-com" };
const REQUIRED_VARS = [
  "BETTER_AUTH_SECRET",
  "SITE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

// The fake `convex` keeps its deployments in a JSON file and writes the same
// `.env.local` lines the real CLI writes on select. Every call is appended to
// calls.jsonl, so a test asserts the commands issued and nothing else.
const FAKE_CONVEX = `
import { existsSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const stateDir = process.env.FAKE_CONVEX_STATE;
const statePath = join(stateDir, "deployments.json");
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { next: 1, deployments: {} };
const save = () => writeFileSync(statePath, JSON.stringify(state));
const args = process.argv.slice(2);
appendFileSync(join(stateDir, "calls.jsonl"), JSON.stringify({ args, cwd: process.cwd() }) + "\\n");

const fail = (message) => { console.error(message); process.exit(1); };
const parseSelector = (selector) => {
  const [team, project, ref] = selector.split(":");
  if (ref === undefined) fail("fake convex: selectors must be team:project:ref");
  return { team, project, ref };
};
const find = ({ ref }) =>
  Object.values(state.deployments).find((d) => (ref === "dev" ? d.isDefault : d.ref === ref));
const select = (d) =>
  writeFileSync(
    ".env.local",
    "# Deployment used by \`npx convex dev\`\\n" +
      "CONVEX_DEPLOYMENT=dev:" + d.name + " # team: " + d.team + ", project: " + d.project + "\\n\\n" +
      "CONVEX_URL=https://" + d.name + ".convex.cloud\\n\\n" +
      "CONVEX_SITE_URL=https://" + d.name + ".convex.site\\n",
  );
const selected = () => {
  if (!existsSync(".env.local")) fail("fake convex: no deployment selected");
  const name = readFileSync(".env.local", "utf8").match(/^CONVEX_DEPLOYMENT=dev:(\\S+)/m)?.[1];
  const d = name && state.deployments[name];
  if (!d) fail("fake convex: selected deployment " + name + " is gone");
  return d;
};

const [command, sub, ...rest] = args;
if (command === "deployment" && sub === "select") {
  const target = parseSelector(rest[0]);
  const d = find(target);
  if (!d) fail("Deployment \\u201c" + target.ref + "\\u201d not found.");
  select(d);
} else if (command === "deployment" && sub === "create") {
  const target = parseSelector(rest[0]);
  if (process.env.FAKE_CONVEX_FAIL_CREATE) fail("fake convex: create refused");
  if (find(target)) fail("fake convex: " + target.ref + " already exists");
  const name = "fake-" + target.ref.replace(/[^a-z0-9]+/g, "-") + "-" + state.next++;
  const d = { ...target, name, isDefault: rest.includes("--default"), vars: {} };
  state.deployments[name] = d;
  save();
  if (rest.includes("--select")) select(d);
} else if (command === "env" && sub === "list") {
  console.log(Object.keys(selected().vars).join("\\n"));
} else if (command === "env" && sub === "set") {
  const d = selected();
  d.vars[rest[0]] = rest[1];
  save();
} else if (command === "dev" && sub === "--once") {
  const missing = ${JSON.stringify(REQUIRED_VARS)}.filter((n) => !(n in selected().vars));
  if (missing.length > 0) fail(missing[0] + " is not set on this Convex deployment");
} else {
  fail("fake convex: unexpected command " + args.join(" "));
}
`;

const FIXTURE = {
  "package.json": '{\n  "name": "acme-com",\n  "workspaces": ["apps/*", "packages/*"]\n}\n',
  "packages/api/package.json": `{\n  "name": "@acme/api",\n  "convex": ${JSON.stringify(SLUGS)}\n}\n`,
  "packages/api/convex.json": "{}\n",
  "apps/web/package.json": '{\n  "name": "@acme/web",\n  "devSite": { "port": 3000 }\n}\n',
  ".gitignore": ".env.local\n.dev.vars\n",
};

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), "worktree-test-"));
  const root = join(dir, "main");
  for (const [path, text] of Object.entries(FIXTURE)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  mkdirSync(join(root, "scripts"));
  copyFileSync(join(import.meta.dir, "worktree.mjs"), join(root, "scripts/worktree.mjs"));

  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "fake-convex.mjs"), FAKE_CONVEX);
  writeFileSync(
    join(bin, "convex"),
    `#!/bin/sh\nexec "${process.execPath}" "${bin}/fake-convex.mjs" "$@"\n`,
  );
  chmodSync(join(bin, "convex"), 0o755);
  const state = join(dir, "state");
  mkdirSync(state);

  const env = {
    ...process.env,
    PATH: `${bin}${delimiter}${process.env.PATH}`,
    FAKE_CONVEX_STATE: state,
    GIT_CONFIG_GLOBAL: gitConfig,
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "Copy template");

  return {
    dir,
    root,
    env,
    addWorktree(name) {
      const path = join(dir, name);
      git(root, "worktree", "add", "-q", "-b", name, path);
      return path;
    },
    calls() {
      const path = join(state, "calls.jsonl");
      if (!existsSync(path)) return [];
      return readFileSync(path, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line).args);
    },
    clearCalls() {
      rmSync(join(state, "calls.jsonl"), { force: true });
    },
    deployments() {
      return Object.values(
        JSON.parse(readFileSync(join(state, "deployments.json"), "utf8")).deployments,
      );
    },
    expire(ref) {
      const path = join(state, "deployments.json");
      const data = JSON.parse(readFileSync(path, "utf8"));
      for (const [name, d] of Object.entries(data.deployments))
        if (d.ref === ref) delete data.deployments[name];
      writeFileSync(path, JSON.stringify(data));
    },
  };
}

function withFixture(fn) {
  const fixture = makeFixture();
  try {
    return fn(fixture);
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
}

function setup(fixture, cwd, extraEnv = {}) {
  const result = spawnSync(process.execPath, ["scripts/worktree.mjs", "setup"], {
    cwd,
    env: { ...fixture.env, ...extraEnv },
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const read = (dir, path) => readFileSync(join(dir, path), "utf8");
const envValue = (text, key) => text.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1];
const callsNamed = (calls, ...prefix) =>
  calls.filter((args) => prefix.every((word, i) => args[i] === word));

describe("worktree.mjs setup in a worktree", () => {
  test("creates a selected, expiring deployment, sets the four values, pushes, writes the files", () => {
    withFixture((fixture) => {
      const wt = fixture.addWorktree("impl-87");

      const { status } = setup(fixture, wt);

      expect(status).toBe(0);
      const calls = fixture.calls();
      expect(callsNamed(calls, "deployment", "create")).toEqual([
        [
          "deployment",
          "create",
          "acme:acme-com:dev/agent/impl-87",
          "--type",
          "dev",
          "--select",
          "--expiration",
          "in 14 days",
        ],
      ]);
      expect(callsNamed(calls, "dev", "--once")).toHaveLength(1);
      // The push comes last: every value is on the deployment by then.
      expect(calls.at(-1)).toEqual(["dev", "--once"]);

      const [deployment] = fixture.deployments();
      expect(Object.keys(deployment.vars).sort()).toEqual([...REQUIRED_VARS].sort());
      expect(deployment.vars.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(deployment.vars.GOOGLE_CLIENT_ID).toBe("placeholder");
      expect(deployment.vars.GOOGLE_CLIENT_SECRET).toBe("placeholder");

      const devVars = read(wt, "apps/web/.dev.vars");
      const port = Number(envValue(devVars, "PORT"));
      expect(port).toBeGreaterThanOrEqual(3001);
      expect(port).toBeLessThanOrEqual(3099);
      expect(deployment.vars.SITE_URL).toBe(`http://localhost:${port}`);
      const url = `https://${deployment.name}.convex.cloud`;
      expect(envValue(devVars, "CONVEX_URL")).toBe(url);
      expect(envValue(read(wt, "apps/web/.env.local"), "VITE_CONVEX_URL")).toBe(url);
      expect(envValue(read(wt, "packages/api/.env.local"), "CONVEX_DEPLOYMENT")).toContain(
        `dev:${deployment.name}`,
      );
      expect(existsSync(join(fixture.root, "apps/web/.dev.vars"))).toBe(false);
    });
  });

  test("a second run keeps the deployment and changes nothing", () => {
    withFixture((fixture) => {
      const wt = fixture.addWorktree("impl-87");
      expect(setup(fixture, wt).status).toBe(0);
      const before = ["apps/web/.dev.vars", "apps/web/.env.local", "packages/api/.env.local"].map(
        (path) => read(wt, path),
      );
      const secret = fixture.deployments()[0].vars.BETTER_AUTH_SECRET;
      fixture.clearCalls();

      const { status } = setup(fixture, wt);

      expect(status).toBe(0);
      const calls = fixture.calls();
      expect(callsNamed(calls, "deployment", "select")).toEqual([
        ["deployment", "select", "acme:acme-com:dev/agent/impl-87"],
      ]);
      expect(callsNamed(calls, "deployment", "create")).toEqual([]);
      expect(callsNamed(calls, "env", "set")).toEqual([]);
      expect(fixture.deployments()).toHaveLength(1);
      expect(fixture.deployments()[0].vars.BETTER_AUTH_SECRET).toBe(secret);
      const after = ["apps/web/.dev.vars", "apps/web/.env.local", "packages/api/.env.local"].map(
        (path) => read(wt, path),
      );
      expect(after).toEqual(before);
    });
  });

  test("after the deployment expired, a run creates a new one and rewrites the files", () => {
    withFixture((fixture) => {
      const wt = fixture.addWorktree("impl-87");
      expect(setup(fixture, wt).status).toBe(0);
      const port = envValue(read(wt, "apps/web/.dev.vars"), "PORT");
      const oldUrl = envValue(read(wt, "apps/web/.dev.vars"), "CONVEX_URL");
      fixture.expire("dev/agent/impl-87");
      fixture.clearCalls();

      const { status } = setup(fixture, wt);

      expect(status).toBe(0);
      expect(callsNamed(fixture.calls(), "deployment", "create")).toHaveLength(1);
      const [deployment] = fixture.deployments();
      expect(Object.keys(deployment.vars).sort()).toEqual([...REQUIRED_VARS].sort());
      const devVars = read(wt, "apps/web/.dev.vars");
      const url = `https://${deployment.name}.convex.cloud`;
      expect(url).not.toBe(oldUrl);
      expect(envValue(devVars, "CONVEX_URL")).toBe(url);
      // The port survives: the worktree's server keeps its address across deployments.
      expect(envValue(devVars, "PORT")).toBe(port);
      expect(envValue(read(wt, "apps/web/.env.local"), "VITE_CONVEX_URL")).toBe(url);
    });
  });

  test("skips a port another worktree already holds in its .dev.vars", () => {
    withFixture((fixture) => {
      const first = fixture.addWorktree("impl-1");
      mkdirSync(join(first, "apps/web"), { recursive: true });
      writeFileSync(join(first, "apps/web/.dev.vars"), "PORT=3001\n");
      const second = fixture.addWorktree("impl-2");

      expect(setup(fixture, second).status).toBe(0);

      const port = Number(envValue(read(second, "apps/web/.dev.vars"), "PORT"));
      expect(port).not.toBe(3001);
      expect(port).toBeGreaterThan(3001);
      expect(port).toBeLessThanOrEqual(3099);
    });
  });

  test("the reference is the worktree directory name, lowercased and slug-safe", () => {
    withFixture((fixture) => {
      const wt = fixture.addWorktree("Feature_Login.v2");

      expect(setup(fixture, wt).status).toBe(0);

      expect(callsNamed(fixture.calls(), "deployment", "create")[0][2]).toBe(
        "acme:acme-com:dev/agent/feature-login-v2",
      );
    });
  });
});

describe("worktree.mjs setup in the main checkout", () => {
  test("creates the personal dev deployment without expiration and writes no PORT", () => {
    withFixture((fixture) => {
      writeFileSync(
        join(fixture.root, "apps/web/.dev.vars"),
        "CONVEX_URL=https://your-dev-deployment.convex.cloud\nCLOUDFLARE_API_TOKEN=keep-me\n",
      );

      const { status } = setup(fixture, fixture.root);

      expect(status).toBe(0);
      const calls = fixture.calls();
      expect(callsNamed(calls, "deployment", "select")[0]).toEqual([
        "deployment",
        "select",
        "acme:acme-com:dev",
      ]);
      const [create] = callsNamed(calls, "deployment", "create");
      expect(create[2]).toMatch(/^acme:acme-com:dev\/[a-z0-9-]+$/);
      expect(create).toContain("--default");
      expect(create).toContain("--select");
      expect(create).not.toContain("--expiration");
      expect(calls.at(-1)).toEqual(["dev", "--once"]);

      const [deployment] = fixture.deployments();
      expect(deployment.isDefault).toBe(true);
      expect(Object.keys(deployment.vars).sort()).toEqual([...REQUIRED_VARS].sort());
      expect(deployment.vars.SITE_URL).toBe("http://localhost:3000");

      const devVars = read(fixture.root, "apps/web/.dev.vars");
      expect(envValue(devVars, "PORT")).toBeUndefined();
      expect(envValue(devVars, "CONVEX_URL")).toBe(`https://${deployment.name}.convex.cloud`);
      expect(envValue(devVars, "CLOUDFLARE_API_TOKEN")).toBe("keep-me");
    });
  });

  test("keeps an existing personal dev deployment and its values", () => {
    withFixture((fixture) => {
      expect(setup(fixture, fixture.root).status).toBe(0);
      fixture.clearCalls();

      expect(setup(fixture, fixture.root).status).toBe(0);

      const calls = fixture.calls();
      expect(callsNamed(calls, "deployment", "create")).toEqual([]);
      expect(callsNamed(calls, "env", "set")).toEqual([]);
      expect(fixture.deployments()).toHaveLength(1);
    });
  });

  test("sets only the values the deployment is missing", () => {
    withFixture((fixture) => {
      expect(setup(fixture, fixture.root).status).toBe(0);
      const statePath = join(fixture.dir, "state/deployments.json");
      const data = JSON.parse(readFileSync(statePath, "utf8"));
      const [name] = Object.keys(data.deployments);
      data.deployments[name].vars = {
        SITE_URL: "https://dev.acme.com",
        BETTER_AUTH_SECRET: "real",
      };
      writeFileSync(statePath, JSON.stringify(data));
      fixture.clearCalls();

      expect(setup(fixture, fixture.root).status).toBe(0);

      const set = callsNamed(fixture.calls(), "env", "set").map((args) => args[2]);
      expect(set.sort()).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
      expect(fixture.deployments()[0].vars.SITE_URL).toBe("https://dev.acme.com");
    });
  });
});

describe("worktree.mjs setup refuses to guess", () => {
  test("fails before any convex call while the slugs are the template placeholders", () => {
    withFixture((fixture) => {
      writeFileSync(
        join(fixture.root, "packages/api/package.json"),
        '{\n  "name": "@acme/api",\n  "convex": { "team": "your-convex-team", "project": "your-convex-project" }\n}\n',
      );

      const { status, stderr } = setup(fixture, fixture.root);

      expect(status).toBe(1);
      expect(stderr).toContain("packages/api/package.json");
      expect(fixture.calls()).toEqual([]);
    });
  });

  test("fails when the slugs are absent", () => {
    withFixture((fixture) => {
      writeFileSync(
        join(fixture.root, "packages/api/package.json"),
        '{\n  "name": "@acme/api"\n}\n',
      );

      const { status, stderr } = setup(fixture, fixture.root);

      expect(status).toBe(1);
      expect(stderr).toContain("convex.team");
      expect(fixture.calls()).toEqual([]);
    });
  });

  test("stops at a failed create: no push, no files", () => {
    withFixture((fixture) => {
      const wt = fixture.addWorktree("impl-87");

      const { status } = setup(fixture, wt, { FAKE_CONVEX_FAIL_CREATE: "1" });

      expect(status).toBe(1);
      expect(callsNamed(fixture.calls(), "dev", "--once")).toEqual([]);
      expect(existsSync(join(wt, "apps/web/.dev.vars"))).toBe(false);
    });
  });
});
