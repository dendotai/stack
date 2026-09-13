- **`PORT` picks the web dev server's port** (`apps/web`): with `PORT` set —
  in the process environment or in `apps/web/.env.local` — `bun dev` serves
  `http://localhost:<PORT>` on localhost only and skips the devsite host and
  its HMR-through-proxy setup, so a second checkout (an agent worktree) runs
  beside the main one. Without `PORT` nothing changes: the port still comes
  from `package.json#devSite`. The screenshot scripts (`auth:login`,
  `screenshots`) target `http://localhost:<PORT>` by default when it is set;
  `STACK_BASE_URL` still wins. The `dev` script drops its `--port`/`--strictPort`
  flags, which `vite.config.ts` already set, so the config is the one source.
  To apply: copy `apps/web/dev-server.ts`, `apps/web/dev-server.test.ts`,
  `apps/web/vite.config.ts` and `apps/web/scripts/base-url.mjs` with its test;
  edit the two scripts to import `baseUrl`; add `*.test.ts` and
  `scripts/*.test.mjs` to `vitest.config.ts` and `*.ts` to `tsconfig.json`'s
  `include`; set `"dev": "vite dev"`; and take the `PORT` block from
  [`apps/web/.env.local.example`](apps/web/.env.local.example).
