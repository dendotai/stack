#!/usr/bin/env bun
// Initialize a new project from the `dendotai/stack` template.
//
//   bun scripts/init.mjs --name <domain-dashed> [overrides…]
//   bun scripts/init.mjs --check
//
// The only required flag is --name, given as the domain with dots→dashes (the
// repo-naming convention: widget-io, acme-com). Everything else is derived
// from it, and any derived value can be overridden with its own flag:
//
//   --name        acme-com        (required) repo / package / worker name
//   --domain      acme.com        (derived: last "-" → ".")  prod custom domain
//   --scope       acme-com        (derived: same as --name)  @scope/ + host + env
//   --dev-domain  dev.acme.com    (derived: "dev." + domain) dev custom domain
//   --host        acme-com.internal (derived: scope + ".internal") devSite host
//   --dry-run                             print what would change, write nothing
//   --no-commit                           leave the rewrite uncommitted
//   --check                               fail if any placeholder is still present
//
// e.g.
//   bun scripts/init.mjs --name acme-com
//   bun scripts/init.mjs --name acme-com --scope acme  # shorter @acme/api
//   bun scripts/init.mjs --name acme-app --domain acme.dev --scope acme
//
// Rewrites the template's placeholder tokens (below), copies the gitignored
// `*.example` env files into place, and commits the rewritten files as
// "Initialize from template: <name>". The commit is the point: an uncommitted
// rewrite is one `git reset --hard` away from a half-renamed repo that only
// fails at deploy time. On a repo with no commits yet the whole tree is the
// first commit. It does NOT touch VERSION or TEMPLATE_CHANGELOG.md — those
// record which template version you started from, so future template updates
// can be applied (see README).
//
// After the commit the repository holds the two branches deploy.yml reads,
// `main` (production) and `dev` (where work integrates), both at that commit,
// with `dev` checked out. Push `dev` first and GitHub makes it the default
// branch, so pull requests target it (docs/SETUP.md §4). A fresh repository's
// only branch is renamed to `main`; branches that already exist are kept.
//
// `--check` walks the tree for the same placeholders and exits 1 naming every
// file that still has one. A project's CI runs it so a lost rewrite fails
// there, not at deploy. It fails on the template itself by design.
//
//   @stack/            → @<scope>/            (workspace package scope)
//   dev.stack.example  → <dev-domain>         (dev custom domain)
//   stack.example      → <domain>             (prod custom domain)
//   stack.internal     → <host>               (devSite host)
//   "name": "stack"    → "name": "<name>"     (root package.json, wrangler.jsonc)
//   stack-dev/-prod    → <name>-dev/-prod     (worker names)
//   STACK_BASE_URL     → <SCOPE>_BASE_URL      (screenshot tooling env)
//
// Display strings (the landing <h1>, the <title>, README headings) are left for
// you to edit by taste — `grep -rn '\bstack\b'` to find them.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

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
      out[body] = true; // boolean flag, e.g. --dry-run
    }
  }
  return out;
}

const USAGE =
  "usage: bun scripts/init.mjs --name <domain-dashed> [--domain d] [--scope s] " +
  "[--dev-domain d] [--host h] [--dry-run] [--no-commit]\n" +
  "       bun scripts/init.mjs --check\n" +
  "e.g.   bun scripts/init.mjs --name acme-com";

const ROOT = join(__dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".wrangler", ".tanstack", ".auth"]);
// The two scripts name the placeholders on purpose; the changelog is template
// history and may quote them in prose.
const SKIP_FILES = new Set(["scripts/init.mjs", "scripts/init.test.mjs", "TEMPLATE_CHANGELOG.md"]);

// Order matters: dev.stack.example before stack.example; the scope before the
// bare name so "@stack/" isn't half-rewritten.
const REPLACEMENTS = [
  ["@stack/", (c) => `@${c.scope}/`],
  ["dev.stack.example", (c) => c.devDomain],
  ["stack.example", (c) => c.domain],
  ["stack.internal", (c) => c.host],
  [`"name": "stack"`, (c) => `"name": "${c.name}"`],
  ["stack-dev", (c) => `${c.name}-dev`],
  ["stack-prod", (c) => `${c.name}-prod`],
  ["STACK_BASE_URL", (c) => c.baseEnv],
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function* textFiles() {
  for (const file of walk(ROOT)) {
    if (SKIP_FILES.has(relative(ROOT, file))) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    yield [file, text];
  }
}

function warn(lines) {
  console.error(`\n\x1b[1;31m${lines.map((l) => `  ${l}`).join("\n")}\x1b[0m\n`);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const flags = parseFlags(process.argv.slice(2));

if (flags.check === true) {
  const leftovers = [];
  for (const [file, text] of textFiles()) {
    for (const [placeholder] of REPLACEMENTS) {
      if (text.includes(placeholder)) leftovers.push(`${relative(ROOT, file)}: ${placeholder}`);
    }
  }
  if (leftovers.length === 0) {
    console.log("  ✓ no template placeholders left");
    process.exit(0);
  }
  warn([
    `${leftovers.length} template placeholder(s) still present — the init rewrite is`,
    "missing or was partly reverted. Re-run `bun scripts/init.mjs --name <name>`.",
    "",
    ...leftovers.map((l) => `  ${l}`),
  ]);
  process.exit(1);
}

const name = typeof flags.name === "string" ? flags.name : undefined;
if (!name) {
  console.error(USAGE);
  process.exit(1);
}

// Derive the rest from --name; each is overridable via its own flag.
// Scope defaults to the full name for uniformity (@acme-com/api), so
// --name is the single token that flows everywhere. Pass --scope for a shorter
// brand form (e.g. --scope acme → @acme/api).
const domain = flags.domain ?? name.replace(/-(?=[^-]+$)/, "."); // last "-" → "."
const scope = flags.scope ?? name;
const devDomain = flags["dev-domain"] ?? `dev.${domain}`;
const host = flags.host ?? `${scope}.internal`;
const baseEnv = `${scope.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_BASE_URL`;
const config = { name, scope, domain, devDomain, host, baseEnv };
const dryRun = flags["dry-run"] === true;
const commit = flags["no-commit"] !== true;
const COMMIT_MESSAGE = `Initialize from template: ${name}`;
const COMMIT_HINT = `git add -A && git commit -m "${COMMIT_MESSAGE}"`;
const BRANCH_HINT = "git branch -M main && git switch -c dev";

console.log("\n  Resolved config:");
for (const [label, value] of [
  ["name", name],
  ["scope", `@${scope}`],
  ["domain", domain],
  ["dev-domain", devDomain],
  ["host", host],
  ["base-url env", baseEnv],
]) {
  console.log(`    ${label.padEnd(13)} ${value}`);
}
console.log(dryRun ? "  (dry run — nothing written, nothing committed)\n" : "");

const rewritten = [];
for (const [file, text] of textFiles()) {
  let next = text;
  for (const [from, to] of REPLACEMENTS) next = next.split(from).join(to(config));
  if (next !== text) {
    if (dryRun) console.log(`  · would rewrite ${relative(ROOT, file)}`);
    else writeFileSync(file, next);
    rewritten.push(file);
  }
}

if (!dryRun) {
  // Copy the gitignored env templates into place (don't overwrite real ones).
  for (const ex of [
    "apps/web/.dev.vars.example",
    "apps/web/.env.local.example",
    "packages/api/.env.local.example",
  ]) {
    const dest = join(ROOT, ex.replace(/\.example$/, ""));
    const src = join(ROOT, ex);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      console.log(`  · created ${relative(ROOT, dest)} (fill it in)`);
    }
  }
}

console.log(
  `\n  ${dryRun ? "would rewrite" : "✓ rewrote"} ${rewritten.length} files for "${name}" (@${scope}, ${domain})`,
);
if (dryRun) {
  if (commit) console.log("  would commit, then leave main and dev at that commit, on dev");
  process.exit(0);
}

function commitRewrite() {
  let toplevel;
  try {
    toplevel = git(["rev-parse", "--show-toplevel"]);
  } catch {
    return [
      "not a git repository — the rewrite is NOT committed. Init one and commit",
      "before any other git operation:",
      `  git init && ${COMMIT_HINT}`,
      `  ${BRANCH_HINT}`,
    ];
  }
  if (toplevel !== realpathSync(ROOT)) {
    return [
      `the git repository is ${toplevel}, not this directory — the rewrite is NOT`,
      "committed. Commit it there yourself, or `git init` here first, before any",
      "other git operation:",
      `  ${COMMIT_HINT}`,
      `  ${BRANCH_HINT}`,
    ];
  }
  let unborn = false;
  try {
    git(["rev-parse", "--verify", "-q", "HEAD"]);
  } catch {
    unborn = true;
  }
  try {
    // On a first commit the whole template is the commit; otherwise only the
    // files this run rewrote, so unrelated local edits — staged or not — stay
    // out of it.
    const paths = unborn ? ["."] : rewritten;
    git(["add", "-A", "--", ...paths]);
    git(["commit", "-q", "-m", COMMIT_MESSAGE, "--", ...paths]);
    return null;
  } catch (error) {
    return [
      "git commit failed — the rewrite is NOT committed. Fix the cause and commit",
      "before any other git operation:",
      `  ${COMMIT_HINT}`,
      `  ${BRANCH_HINT}`,
      "",
      ...String(error.stderr ?? error.message)
        .trim()
        .split("\n"),
    ];
  }
}

function branchExists(branch) {
  try {
    git(["rev-parse", "--verify", "-q", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

// Returns the line to print. `dev` is only checked out when it points at
// HEAD: switching to a `dev` that is behind would show the old tree and make
// the commit look lost.
function setUpBranches() {
  const current = git(["branch", "--show-current"]); // "" when HEAD is detached
  if (!branchExists("main")) {
    if (current && current !== "dev") git(["branch", "-m", "main"]);
    else git(["branch", "main"]);
  }
  if (!branchExists("dev")) git(["branch", "dev"]);
  if (git(["rev-parse", "refs/heads/dev"]) !== git(["rev-parse", "HEAD"])) {
    return `· dev is behind, staying on ${git(["branch", "--show-current"])}`;
  }
  git(["switch", "-q", "dev"]);
  const aligned = git(["rev-parse", "refs/heads/main"]) === git(["rev-parse", "HEAD"]);
  return aligned ? "✓ on dev, main at the same commit" : "✓ on dev";
}

let failure = null;
if (commit && rewritten.length > 0) {
  failure = commitRewrite();
  if (!failure) {
    console.log(`  ✓ committed as ${git(["rev-parse", "--short", "HEAD"])}`);
    try {
      console.log(`  ${setUpBranches()}`);
    } catch (error) {
      failure = [
        "branch setup failed — the rewrite is committed, but main and dev are not",
        "in place. Fix the cause, then:",
        `  ${BRANCH_HINT}`,
        "",
        ...String(error.stderr ?? error.message)
          .trim()
          .split("\n"),
      ];
    }
  }
}

console.log("\n  Next:");
console.log("   1. Edit display strings: grep -rn '\\bstack\\b' --exclude-dir=node_modules .");
console.log("   2. bun install");
console.log("   3. Follow docs/SETUP.md: create the GitHub repo (push dev first), then");
console.log("      provision Cloudflare / Convex and wire the secrets.");
console.log("   4. Fill the .dev.vars / .env.local files this script created.");
console.log("   5. cd packages/api && bunx convex dev   (links your dev deployment)\n");

if (failure) {
  warn(failure);
  process.exit(1);
}
if (!commit && rewritten.length > 0) {
  warn([
    "--no-commit: the rewrite is not committed. Commit it before any other git",
    "operation — a checkout, reset or stash can silently drop it — then set up",
    "the deploy branches:",
    `  ${COMMIT_HINT}`,
    `  ${BRANCH_HINT}`,
  ]);
}
