- **One naming rule for credentials created in a platform dashboard**
  (`docs/SETUP.md`, `scripts/secrets.manifest.json`,
  `scripts/secrets-scaffold.mjs`): prefix the name with the project wherever
  the platform's namespace is account-global, keep the platform default where
  it is already the project's own. The Cloudflare API token is
  `<project> gha deploy` (one token for both environments; the creation
  dialog otherwise keeps the template's name, and an account with several
  projects then lists identical rows), the Convex deploy keys are `gha-dev`
  and `gha-prod`. SETUP.md states the rule in a new "Names in the issuing
  dashboards" section and names each credential at its creation step; the
  manifest carries the names as `issuedAs`, and the scaffold script prints
  them with `--print` and after creating the items. To apply: copy the three
  files and rename any token still called "Edit Cloudflare Workers" in the
  Cloudflare dashboard.
