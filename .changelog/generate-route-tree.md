- **`routeTree.gen.ts` is generated, not committed** (`apps/web`): the file is
  now gitignored and untracked, so two branches that touch routes no longer
  conflict in a file nobody edits by hand. `@tanstack/router-cli` is a new
  devDependency and `bun run generate` (`tsr generate`) rebuilds it;
  `typecheck`, `test` and `build` each run that first, so a fresh clone needs
  no extra step. Generator options move out of an inline argument in
  `vite.config.ts` into a new `apps/web/tsr.config.json` that both the CLI and
  the Vite plugin read — chiefly `routeFileIgnorePattern`, which keeps the
  colocated tests out of the route scan. To apply: copy
  `apps/web/tsr.config.json`, add the `.gitignore` line and the devDependency,
  take the four `apps/web` scripts and the bare `tanstackStart()` call, then
  `git rm --cached apps/web/src/routeTree.gen.ts`.
