#!/usr/bin/env bun
// Give this checkout its own Convex dev deployment and the env files to use it.
//
//   bun run worktree:setup                 (= bun scripts/worktree.mjs setup)
//   bun scripts/worktree.mjs setup [--name <worktree-name>]
//
// In a git worktree the deployment is `<team>:<project>:dev/agent/<name>`,
// where <name> is the worktree directory's name, and it expires in 14 days.
// In the main checkout it is the developer's personal dev deployment, with
// no expiration. `--name` forces the worktree form with that name.
//
// The team and project slugs come from `packages/api/package.json`
// (`convex.team`, `convex.project`). The Convex CLI's own login on this
// machine is the credential; nothing is stored.
//
// What one run does, in order:
//   1. `convex deployment select` the deployment; when that fails (no such
//      deployment yet, or it expired) `convex deployment create --select`.
//      Either way `packages/api/.env.local` now names it.
//   2. Pick a free port in the 3001–3099 band for the worktree (a rerun keeps
//      the port already in `.env.local`; 3000 is the main checkout's).
//   3. Write `apps/web/.dev.vars` (CONVEX_URL) and `apps/web/.env.local`
//      (PORT, VITE_CONVEX_URL) — `.env.local` is the file the web dev server
//      reads PORT from. Other lines are kept.
//   4. Set the values the first push needs and that the deployment lacks:
//      a generated BETTER_AUTH_SECRET, SITE_URL=http://localhost:<port>, and
//      placeholder Google client values. Values already set are never touched.
//   5. `convex dev --once` — one push, so the deployment matches the checkout.
//
// A rerun therefore changes nothing while the deployment exists, and replaces
// it when it is gone.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { userInfo } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";

const ROOT = join(__dirname, "..");
const API_DIR = join(ROOT, "packages/api");
const WEB_DIR = join(ROOT, "apps/web");
const CONVEX_BIN_DIR = join(API_DIR, "node_modules/.bin");
const EXPIRATION = "in 14 days";
// 3000 belongs to the main checkout's dev server, so worktrees start above it.
const PORT_BAND = { first: 3001, last: 3099 };
const PLACEHOLDER_SLUGS = { team: "your-convex-team", project: "your-convex-project" };
const GOOGLE_PLACEHOLDER = "placeholder";

const USAGE = "usage: bun scripts/worktree.mjs setup [--name <worktree-name>]";

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      out[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      out[body] = argv[++i];
    } else {
      out[body] = true;
    }
  }
  return out;
}

function fail(lines) {
  console.error(`\n\x1b[1;31m${lines.map((l) => `  ${l}`).join("\n")}\x1b[0m\n`);
  process.exit(1);
}

function git(args) {
  return spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function convex(args, { capture = false } = {}) {
  const result = spawnSync("convex", args, {
    cwd: API_DIR,
    env: { ...process.env, PATH: `${CONVEX_BIN_DIR}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
    stdio: ["inherit", capture ? "pipe" : "inherit", "inherit"],
  });
  if (result.error) fail([`could not run convex: ${result.error.message}`]);
  return result;
}

function convexOrFail(args, options) {
  const result = convex(args, options);
  if (result.status !== 0) fail([`convex ${args.join(" ")} failed (exit ${result.status})`]);
  return result;
}

// Convex references allow only lowercase letters, digits, `-` and `/`.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readSlugs() {
  const file = "packages/api/package.json";
  const pkg = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
  const team = pkg.convex?.team;
  const project = pkg.convex?.project;
  if (typeof team !== "string" || typeof project !== "string") {
    fail([`${file} has no convex.team / convex.project — the Convex team and project slugs.`]);
  }
  if (team === PLACEHOLDER_SLUGS.team || project === PLACEHOLDER_SLUGS.project) {
    fail([
      `${file} still has the template's convex.team / convex.project placeholders.`,
      "Put your Convex team and project slugs there (docs/SETUP.md §2).",
    ]);
  }
  return { team, project };
}

// A linked worktree has its own git dir under the main checkout's `.git`;
// the main checkout's git dir and common dir are the same directory.
function worktreeName() {
  const gitDir = git(["rev-parse", "--git-dir"]);
  const commonDir = git(["rev-parse", "--git-common-dir"]);
  if (gitDir.status !== 0 || commonDir.status !== 0) return null;
  if (resolve(ROOT, gitDir.stdout.trim()) === resolve(ROOT, commonDir.stdout.trim())) return null;
  return basename(ROOT);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) out[match[1]] = match[2].replace(/\s+#.*$/, "").trim();
  }
  return out;
}

// Replaces the line of each key that exists and appends the others, so the
// developer's own lines in the file survive.
function upsertEnvFile(path, entries) {
  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(text)) text = text.replace(pattern, line);
    else text += `${text.length === 0 || text.endsWith("\n") ? "" : "\n"}${line}\n`;
  }
  writeFileSync(path, text);
}

// Ports the sibling worktrees wrote into their own `.env.local`; a server there
// need not be running for the port to be taken.
function portsHeldByWorktrees() {
  const held = new Set();
  const list = git(["worktree", "list", "--porcelain"]);
  if (list.status !== 0) return held;
  for (const line of list.stdout.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const dir = line.slice("worktree ".length);
    if (resolve(dir) === resolve(ROOT)) continue;
    const port = Number(parseEnvFile(join(dir, "apps/web/.env.local")).PORT);
    if (Number.isInteger(port)) held.add(port);
  }
  return held;
}

function isFree(port) {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => done(false));
    server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
  });
}

async function pickPort(current) {
  if (current >= PORT_BAND.first && current <= PORT_BAND.last) return current;
  const held = portsHeldByWorktrees();
  for (let port = PORT_BAND.first; port <= PORT_BAND.last; port++) {
    if (!held.has(port) && (await isFree(port))) return port;
  }
  return fail([`no free port between ${PORT_BAND.first} and ${PORT_BAND.last}`]);
}

function mainCheckoutPort() {
  const pkg = JSON.parse(readFileSync(join(WEB_DIR, "package.json"), "utf8"));
  return pkg.devSite?.port ?? 3000;
}

async function setup(flags) {
  const { team, project } = readSlugs();
  const name = typeof flags.name === "string" ? flags.name : worktreeName();
  const inWorktree = name !== null;
  const selector = inWorktree
    ? `${team}:${project}:dev/agent/${slugify(name)}`
    : `${team}:${project}:dev`;

  console.log(`\n  Deployment: ${selector}`);
  if (convex(["deployment", "select", selector]).status !== 0) {
    console.log(`  · not found, creating`);
    const createArgs = inWorktree
      ? [selector, "--type", "dev", "--select", "--expiration", EXPIRATION]
      : [
          `${team}:${project}:dev/${slugify(userInfo().username)}`,
          "--type",
          "dev",
          "--default",
          "--select",
        ];
    convexOrFail(["deployment", "create", ...createArgs]);
  }

  const apiEnv = parseEnvFile(join(API_DIR, ".env.local"));
  const url = apiEnv.CONVEX_URL;
  if (!url) fail(["packages/api/.env.local has no CONVEX_URL after the selection"]);

  const envLocalPath = join(WEB_DIR, ".env.local");
  const port = inWorktree
    ? await pickPort(Number(parseEnvFile(envLocalPath).PORT))
    : mainCheckoutPort();
  upsertEnvFile(join(WEB_DIR, ".dev.vars"), { CONVEX_URL: url });
  upsertEnvFile(envLocalPath, { ...(inWorktree ? { PORT: port } : {}), VITE_CONVEX_URL: url });
  console.log(`  · ${url}${inWorktree ? `, app on http://localhost:${port}` : ""}`);

  const present = new Set(
    convexOrFail(["env", "list", "--names-only"], { capture: true })
      .stdout.split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const wanted = {
    BETTER_AUTH_SECRET: () => randomBytes(32).toString("base64"),
    SITE_URL: () => `http://localhost:${port}`,
    GOOGLE_CLIENT_ID: () => GOOGLE_PLACEHOLDER,
    GOOGLE_CLIENT_SECRET: () => GOOGLE_PLACEHOLDER,
  };
  for (const [key, value] of Object.entries(wanted)) {
    if (present.has(key)) continue;
    console.log(`  · setting ${key}`);
    convexOrFail(["env", "set", key, value()]);
  }

  convexOrFail(["dev", "--once"]);
  console.log(`\n  ✓ ${selector} is selected, pushed, and in the env files\n`);
}

const [command, ...rest] = process.argv.slice(2);
if (command !== "setup") {
  console.error(USAGE);
  process.exit(1);
}
await setup(parseFlags(rest));
