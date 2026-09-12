- **GitHub environment renamed `production` → `prod`** so every environment name in
  the stack reads the same: `.github/workflows/deploy.yml` selects `prod` from
  `main`, matching the Cloudflare env (`CLOUDFLARE_ENV: prod`, worker `<name>-prod`)
  and the `<project> prod` secrets item. `docs/SETUP.md` says `prod` throughout;
  Convex's own "production deployment" keeps that name. To apply: in repo Settings →
  Environments create `prod`, copy every secret, variable and protection rule from
  `production`, delete `production`, then copy the workflow file. Do both in one go —
  a push to `main` against a `prod` environment with no secrets fails the deploy.
