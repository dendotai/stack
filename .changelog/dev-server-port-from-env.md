- **`PORT` also comes from `apps/web/.env.local`, and the screenshot scripts
  follow it** (`apps/web`): the worktree override for the web dev server now
  reads `PORT` from the process environment or from `.env.local` (through
  Vite's `loadEnv`; the environment wins), fails on a value that is not a TCP
  port number, and binds on localhost only. The rule lives in
  `apps/web/dev-server.ts` as a pure function with a test. The screenshot
  scripts (`auth:login`, `screenshots`) target `http://localhost:<PORT>` by
  default when it is set; `STACK_BASE_URL` still wins. To apply: copy
  `apps/web/dev-server.ts` and `apps/web/dev-server.test.ts`,
  `apps/web/vite.config.ts`, and `apps/web/scripts/base-url.mjs` with its
  test; edit the two scripts to import `baseUrl`; add `*.test.ts` and
  `scripts/*.test.mjs` to `vitest.config.ts` and `*.ts` to `tsconfig.json`'s
  `include`; and take the `PORT` block from
  [`apps/web/.env.local.example`](apps/web/.env.local.example).
