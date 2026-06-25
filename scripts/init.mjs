#!/usr/bin/env bun
// Initialize a new project from the `dendotai/stack` template.
//
//   bun scripts/init.mjs <project> <scope> <prod-domain> <dev-domain>
//
// e.g.
//   bun scripts/init.mjs targetlocked targetlocked targetlocked.com dev.targetlocked.com
//
// Rewrites the template's placeholder tokens to your project's, and copies the
// gitignored `*.example` env files into place for you to fill. It does NOT touch
// VERSION or TEMPLATE_CHANGELOG.md — those record which template version you
// started from, so future template updates can be applied (see README).
//
// Placeholder tokens replaced (machine-critical, distinctive so they don't
// collide with "TanStack" etc.):
//   @stack/            → @<scope>/            (workspace package scope)
//   dev.stack.example  → <dev-domain>         (dev custom domain)
//   stack.example      → <prod-domain>        (prod custom domain)
//   stack.internal     → <project>.internal   (devSite host)
//   "name": "stack"    → "name": "<project>"  (root package.json, wrangler.jsonc)
//   stack-dev/-prod    → <project>-dev/-prod  (worker names)
//   STACK_BASE_URL     → <PROJECT>_BASE_URL   (screenshot tooling env)
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

const [project, scope, prodDomain, devDomain] = process.argv.slice(2);
if (!project || !scope || !prodDomain || !devDomain) {
  console.error(
    "usage: bun scripts/init.mjs <project> <scope> <prod-domain> <dev-domain>\n" +
      "e.g.   bun scripts/init.mjs targetlocked targetlocked targetlocked.com dev.targetlocked.com",
  );
  process.exit(1);
}

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".wrangler", ".tanstack", ".auth"]);

// Order matters: dev.stack.example before stack.example; the scope before the
// bare name so "@stack/" isn't half-rewritten.
const REPLACEMENTS = [
  ["@stack/", `@${scope}/`],
  ["dev.stack.example", devDomain],
  ["stack.example", prodDomain],
  ["stack.internal", `${project}.internal`],
  [`"name": "stack"`, `"name": "${project}"`],
  ["stack-dev", `${project}-dev`],
  ["stack-prod", `${project}-prod`],
  ["STACK_BASE_URL", `${project.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_BASE_URL`],
];

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
    writeFileSync(file, next);
    changed++;
  }
}

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

console.log(`\n  ✓ rewrote ${changed} files for "${project}" (@${scope}, ${prodDomain})`);
console.log("\n  Next:");
console.log("   1. Edit display strings: grep -rn '\\bstack\\b' --exclude-dir=node_modules .");
console.log("   2. bun install");
console.log("   3. Follow docs/SETUP.md to provision Cloudflare / Convex / WorkOS / GitHub.");
console.log("   4. Fill the .dev.vars / .env.local files this script created.");
console.log("   5. cd packages/api && bunx convex dev   (links your dev deployment)\n");
