- **`bun run worktree:setup` gives a checkout its own Convex dev deployment:**
  `scripts/worktree.mjs` selects or creates it — a 14-day
  `dev/agent/<worktree-name>` deployment in a git worktree, the personal dev
  deployment in the main checkout — sets the four auth values the push needs
  (generated secret, localhost `SITE_URL`, placeholder Google client), pushes
  once, and writes `apps/web/.dev.vars` (`PORT`, `CONVEX_URL`) and
  `apps/web/.env.local` (`VITE_CONVEX_URL`). To apply: copy
  `scripts/worktree.mjs` and `scripts/worktree.test.mjs`, add the
  `worktree:setup` script to the root `package.json`, and put your Convex team
  and project slugs into `packages/api/package.json` under `convex`
  ([README](README.md#worktrees), [docs/SETUP.md](docs/SETUP.md#2-convex-two-deployments)).
