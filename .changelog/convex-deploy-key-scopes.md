- **Convex deploy-key scopes** (`docs/SETUP.md`, `.github/workflows/deploy.yml`):
  the CI key needs `deployment:deploy` **and** `deployment:data:view` — the
  component install/diff path reads deployment data, and `convex.config.ts`
  installs the Better Auth component, so a `deployment:deploy`-only key fails
  the first push. A deploy-time `convex run migrations:runAll` step also needs
  `deployment:functions:runInternalMutations` (not `deployment:data:write`),
  and `migrations.runner([])` throws `Specify the migration`, so an empty
  registry needs a no-op `runAll` — both recorded in the new "Deploy-key
  scopes" section. To apply: check each `CONVEX_DEPLOY_KEY`'s scopes against
  that section; the rest is docs and workflow comments.
