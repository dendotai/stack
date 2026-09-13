- **`@den-ai/devsite` from npm, no fixed dev port** (`apps/web`, root
  `package.json`): the web app's Vite config runs the published
  [`@den-ai/devsite`](https://www.npmjs.com/package/@den-ai/devsite) plugin,
  which binds a free port and registers `https://<host>` with the local Caddy
  itself, so `package.json#devSite` keeps only `host` and the `dev` script is
  plain `vite dev`. A root `devsite` script runs the one-time `devsite init`.
  `PORT`, when set, is the exception for a second checkout (an agent
  worktree): Vite binds that port on localhost and the plugin stays off, so
  the checkout does not take the host's route from the main checkout. To
  apply: add `@den-ai/devsite` to the root and `apps/web` dev dependencies,
  copy `apps/web/vite.config.ts`, drop `devSite.port` and the `--port
  --strictPort` flags from `apps/web/package.json`, add the root script, and
  see `docs/SETUP.md` Prerequisites for the machine setup.
