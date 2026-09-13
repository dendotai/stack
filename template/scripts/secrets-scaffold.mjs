#!/usr/bin/env bun
// Create the per-environment secret-manager items from `secrets.manifest.json`.
//
//   bun scripts/secrets-scaffold.mjs [--vault v] [--name n] [--dry-run]
//   bun scripts/secrets-scaffold.mjs --print
//
// The manifest is the source of truth for the item shape docs/SETUP.md reads
// values from: one item per environment (`<name> dev`, `<name> prod`), a
// section per service, env-free field labels. Hand-built items get a label or
// section slightly wrong, and every `op read "op://…"` path built on it fails;
// this script builds them from the manifest instead.
//
//   --vault   <name>   the vault to create the items in (default: the project
//                      name from package.json; created when missing)
//   --name    <name>   the item prefix (default: the project name)
//   --dry-run          read the store, print what would be created, write nothing
//   --print            print the manifest as a checklist and exit; needs no
//                      secret manager at all
//
// The writer targets the 1Password CLI (`op`), signed in. Any other secret
// manager: run `--print` and build the items by hand with the same names.
//
// Fields are created empty for you to fill in the manager's UI, with two
// exceptions the manifest marks: `generate: true` fields get 32 random bytes,
// base64 (never printed), and a `value` with `{domain}` is prefilled per
// environment from the custom domain in `apps/web/wrangler.jsonc`.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

const ROOT = join(__dirname, "..");
const MANIFEST = JSON.parse(readFileSync(join(__dirname, "secrets.manifest.json"), "utf8"));

function warn(lines) {
  console.error(`\n\x1b[1;31m${lines.map((l) => `  ${l}`).join("\n")}\x1b[0m\n`);
}

function op(args, input) {
  return execFileSync("op", args, {
    encoding: "utf8",
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  }).trim();
}

const flags = parseFlags(process.argv.slice(2));
const packageName = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).name;
const name = typeof flags.name === "string" ? flags.name : packageName;
const vault = typeof flags.vault === "string" ? flags.vault : packageName;
const dryRun = flags["dry-run"] === true;

// The custom domain per environment, from wrangler's routes; the deployed
// origin of the web app is derived from it.
const wrangler = (await import(pathToFileURL(join(ROOT, "apps/web/wrangler.jsonc")).href)).default;
const domainOf = (env) => wrangler.env?.[env]?.routes?.[0]?.pattern;

const fieldsOf = (env) => {
  const domain = domainOf(env);
  return MANIFEST.sections.flatMap((section) =>
    section.fields.map((field) => ({
      section: section.label,
      label: field.label,
      secret: field.secret === true,
      generate: field.generate === true,
      for: field.for,
      value: field.value && domain ? field.value.replaceAll("{domain}", domain) : "",
    })),
  );
};

const itemTitle = (env) => `${name} ${env}`;

if (flags.print === true) {
  console.log(`\n  One secret-manager item per environment, in the "${vault}" vault:`);
  for (const env of MANIFEST.environments) console.log(`    "${itemTitle(env)}"`);
  console.log("\n  Each item has these sections and fields:\n");
  for (const section of MANIFEST.sections) {
    console.log(`    ${section.label}`);
    for (const field of section.fields) {
      const kind = field.generate ? "generated" : field.secret ? "secret" : "";
      console.log(`      ${field.label.padEnd(16)} ${kind.padEnd(10)} ${field.for}`);
    }
  }
  console.log("\n  Prefilled values:");
  for (const env of MANIFEST.environments) {
    for (const field of fieldsOf(env)) {
      if (field.value)
        console.log(`    "${itemTitle(env)}" ${field.section}/${field.label} = ${field.value}`);
    }
  }
  console.log(`\n  Read a value: op://${vault}/${itemTitle("dev")}/<section>/<label>\n`);
  process.exit(0);
}

try {
  op(["whoami"]);
} catch {
  warn([
    "the 1Password CLI is not signed in — nothing written. Run `op signin` and",
    "retry, or build the items by hand from `--print` for another secret manager.",
  ]);
  process.exit(1);
}

const vaults = JSON.parse(op(["vault", "list", "--format", "json"]) || "[]");
const vaultExists = vaults.some((v) => v.name === vault);

const existing = vaultExists
  ? JSON.parse(op(["item", "list", "--vault", vault, "--format", "json"]) || "[]")
  : [];
const taken = MANIFEST.environments
  .map(itemTitle)
  .filter((title) => existing.some((item) => item.title === title));
if (taken.length > 0) {
  warn([
    `${taken.map((t) => `"${t}"`).join(", ")} already exists in the "${vault}" vault — nothing written.`,
    "Compare it against `--print`, or pass --name / --vault to create the items elsewhere.",
  ]);
  process.exit(1);
}

console.log(dryRun ? "\n  (dry run — nothing written)" : "");

if (!vaultExists) {
  if (dryRun) console.log(`  · would create vault "${vault}"`);
  else {
    op([
      "vault",
      "create",
      vault,
      "--description",
      `Secrets for ${name}: one item per environment, see docs/SETUP.md`,
    ]);
    console.log(`  ✓ created vault "${vault}"`);
  }
}

for (const env of MANIFEST.environments) {
  const title = itemTitle(env);
  const fields = fieldsOf(env);
  const toFill = fields
    .filter((f) => !f.generate && !f.value)
    .map((f) => `${f.section}/${f.label}`);
  if (dryRun) {
    console.log(
      `  · would create "${title}" with ${fields.length} fields; to fill: ${toFill.join(", ")}`,
    );
    continue;
  }
  // A secure note carries only the fields the manifest names; a login would add
  // username/password fields nothing reads. The value travels on stdin so a
  // generated secret never shows in the process list.
  const item = {
    title,
    category: "SECURE_NOTE",
    sections: MANIFEST.sections.map((s) => ({ id: s.label, label: s.label })),
    fields: fields.map((f) => ({
      id: `${f.section}.${f.label}`,
      type: f.secret ? "CONCEALED" : "STRING",
      label: f.label,
      section: { id: f.section },
      value: f.generate ? randomBytes(32).toString("base64") : f.value,
    })),
  };
  op(["item", "create", "--vault", vault], JSON.stringify(item));
  console.log(`  ✓ created "${title}"`);
  console.log(`    fill in the 1Password app: ${toFill.join(", ")}`);
}

console.log(`\n  Read a value: op://${vault}/${itemTitle("dev")}/<section>/<label>`);
console.log(
  `  e.g. op read "op://${vault}/${itemTitle("dev")}/convex/deploy-key" | gh secret set CONVEX_DEPLOY_KEY --env dev\n`,
);
