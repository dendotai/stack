- **Per-environment secret-manager items come from a manifest**
  (`scripts/secrets.manifest.json`, `scripts/secrets-scaffold.mjs`,
  `docs/SETUP.md`, [ADR 0006](docs/adr/0006-secret-items-from-a-manifest.md)):
  the manifest names the environments, sections and field labels that every
  `op://…` path in SETUP.md reads from, and the script creates the vault and
  the `<project> dev` / `<project> prod` items from it with the 1Password CLI.
  `convex / auth-secret` is generated into each item and never printed;
  `app / site-url` is prefilled from `apps/web/wrangler.jsonc`; every other
  field is created empty. `--print` prints the same shape as a checklist for
  any other secret manager, `--dry-run` reads without writing, and an
  existing item stops the run. SETUP.md's secrets section now comes before
  §1, its `op://` paths carry the vault segment they were missing, the
  `deploy key` label is `deploy-key`, the optional `<project> shared` item is
  gone, and `BETTER_AUTH_SECRET` is piped from the item instead of generated
  at deploy time. `init.mjs` lists the script in its "Next:" steps. To apply:
  copy the two `scripts/` files and `scripts/secrets-scaffold.test.mjs`,
  and re-read the secrets section of SETUP.md.
