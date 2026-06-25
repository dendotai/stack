# Dev screenshot tooling

Drive the running dev app headlessly to capture real, signed-in screenshots —
a throwaway feedback loop for reviewing UI changes (gitignored, regenerated on
demand).

Every app route except `/` and `/login` is WorkOS-gated, and Convex validates
the access token as a real WorkOS JWT, so there's no mock-user shortcut. Instead
we log in **once** interactively and reuse the saved browser session.

## Setup (once)

Make sure the dev server is running (`bun dev` from the repo root) and reachable
at `https://stack.internal` (a Caddy/Tailscale dev origin — the optional
[`@dendotai/devsite`](https://github.com/dendotai/devsite) tool sets this up; or
point `STACK_BASE_URL` at `https://localhost:3000`). Then:

```bash
cd apps/web
bun run auth:login
```

If `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are set in `.dev.vars` (a dedicated
WorkOS test user), the login runs headlessly — no human step. Otherwise a browser
window opens for you to sign in via WorkOS. Either way the session is saved to
`apps/web/.auth/state.json`.

## Capture

```bash
cd apps/web
bun run screenshots /home   # with args: capture only the route(s) you name
bun run screenshots         # no args: sweep the DEFAULT_ROUTES in screenshot.mjs
```

PNGs land in `apps/web/screenshots/` (gitignored, created on first run). The
saved session lives in `apps/web/.auth/`; the test user's `TEST_USER_EMAIL`/
`TEST_USER_PASSWORD` live in `.dev.vars`.

## Notes

- Re-run `bun run auth:login` when `screenshots` reports the session expired.
- Override the origin with `STACK_BASE_URL` (e.g. to hit `localhost:3000`, though
  the WorkOS redirect URI targets your dev host, so the saved cookie is scoped to
  that host).
- Browsers are installed on demand by Playwright; if a run complains about a
  missing browser, run `bunx playwright install chromium`.
- As you add routes, extend `DEFAULT_ROUTES` in `screenshot.mjs` so the no-arg
  sweep covers them.
