#!/usr/bin/env bun
// Initialize a new project from the `dendotai/stack` template.
//
//   bun scripts/init.mjs --name <domain-dashed> [overrides…]
//
// The only required flag is --name, given as the domain with dots→dashes (the
// repo-naming convention: muxa-io, targetlocked-com). Everything else is derived
// from it, and any derived value can be overridden with its own flag:
//
//   --name        targetlocked-com        (required) repo / package / worker name
//   --domain      targetlocked.com        (derived: last "-" → ".")  prod custom domain
//   --scope       targetlocked-com        (derived: same as --name)  @scope/ + host + env
//   --dev-domain  dev.targetlocked.com    (derived: "dev." + domain) dev custom domain
//   --host        targetlocked-com.internal (derived: scope + ".internal") devSite host
//   --dry-run                             print what would change, write nothing
//
// e.g.
//   bun scripts/init.mjs --name targetlocked-com
//   bun scripts/init.mjs --name targetlocked-com --scope targetlocked  # shorter @targetlocked/api
//   bun scripts/init.mjs --name acme-app --domain acme.dev --scope acme
//
// Rewrites the template's placeholder tokens (below) and copies the gitignored
// `*.example` env files into place. It does NOT touch VERSION or
// TEMPLATE_CHANGELOG.md — those record which template version you started from,
// so future template updates can be applied (see README).
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

import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

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
  "[--dev-domain d] [--host h] [--dry-run]\n" +
  "e.g.   bun scripts/init.mjs --name targetlocked-com";

const flags = parseFlags(process.argv.slice(2));
const name = typeof flags.name === "string" ? flags.name : undefined;
if (!name) {
  console.error(USAGE);
  process.exit(1);
}

// Derive the rest from --name; each is overridable via its own flag.
// Scope defaults to the full name for uniformity (@targetlocked-com/api), so
// --name is the single token that flows everywhere. Pass --scope for a shorter
// brand form (e.g. --scope targetlocked → @targetlocked/api).
const domain = flags.domain ?? name.replace(/-(?=[^-]+$)/, "."); // last "-" → "."
const scope = flags.scope ?? name;
const devDomain = flags["dev-domain"] ?? `dev.${domain}`;
const host = flags.host ?? `${scope}.internal`;
const baseEnv = `${scope.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_BASE_URL`;
const dryRun = flags["dry-run"] === true;

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".wrangler", ".tanstack", ".auth"]);

// Order matters: dev.stack.example before stack.example; the scope before the
// bare name so "@stack/" isn't half-rewritten.
const REPLACEMENTS = [
  ["@stack/", `@${scope}/`],
  ["dev.stack.example", devDomain],
  ["stack.example", domain],
  ["stack.internal", host],
  [`"name": "stack"`, `"name": "${name}"`],
  ["stack-dev", `${name}-dev`],
  ["stack-prod", `${name}-prod`],
  ["STACK_BASE_URL", baseEnv],
];

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
console.log(dryRun ? "  (dry run — nothing written)\n" : "");

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

let changed = 0;
for (const file of walk(ROOT)) {
  // Don't rewrite this script or binary assets.
  if (file.endsWith("scripts/init.mjs")) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // binary / unreadable
  }
  let next = text;
  for (const [from, to] of REPLACEMENTS) next = next.split(from).join(to);
  if (next !== text) {
    if (dryRun) console.log(`  · would rewrite ${file.replace(ROOT, "")}`);
    else writeFileSync(file, next);
    changed++;
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
      console.log(`  · created ${dest.replace(ROOT, "")} (fill it in)`);
    }
  }
}

console.log(
  `\n  ${dryRun ? "would rewrite" : "✓ rewrote"} ${changed} files for "${name}" (@${scope}, ${domain})`,
);
if (dryRun) process.exit(0);
console.log("\n  Next:");
console.log("   1. Edit display strings: grep -rn '\\bstack\\b' --exclude-dir=node_modules .");
console.log("   2. bun install");
console.log("   3. Follow docs/SETUP.md to provision Cloudflare / Convex / WorkOS / GitHub.");
console.log("   4. Fill the .dev.vars / .env.local files this script created.");
console.log("   5. cd packages/api && bunx convex dev   (links your dev deployment)\n");
