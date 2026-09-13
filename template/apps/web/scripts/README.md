# Dev screenshot tooling

Drive the running dev app headlessly to capture real, signed-in screenshots —
a throwaway feedback loop for reviewing UI changes (gitignored, regenerated on
demand).

Every app route except `/` and `/login` is gated, and Convex validates the token
as a real Better Auth JWT, so there's no mock-user shortcut. Instead we sign in
**once** through the app's own login form and reuse the saved browser session.

## Setup (once)

Make sure the dev server is running (`bun dev` from the repo root) and reachable
at `https://stack.internal` (a Caddy/Tailscale dev origin — the
[`@den-ai/devsite`](https://www.npmjs.com/package/@den-ai/devsite) plugin
registers it, see `docs/SETUP.md`; or point `STACK_BASE_URL` at the
`http://localhost:<port>` URL the dev server prints). In a checkout that sets
`PORT` (an agent worktree, see `.env.local.example`), the scripts target
`http://localhost:<PORT>` on their own. Then:

```bash
cd apps/web
bun run auth:login
```

If `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are set in `.dev.vars`, the login runs
headlessly — no human step. Create that account once by signing up through
`/login` on the dev deployment. Otherwise a browser window opens for you to sign
in by hand. Either way the session is saved to `apps/web/.auth/state.json`.

## Capture

```bash
cd apps/web
bun run screenshots /home   # with args: capture only the route(s) you name
bun run screenshots         # no args: sweep the DEFAULT_ROUTES in screenshot.mjs
```

PNGs land in `apps/web/screenshots/` (gitignored, created on first run). The
saved session lives in `apps/web/.auth/`; the test user's `TEST_USER_EMAIL`/
`TEST_USER_PASSWORD` live in `.dev.vars`.

## How "signed in" is detected

`selectors.mjs` holds the single definition both scripts import: the **Sign out
button, by role and accessible name**. It is deliberately not a CSS selector —
matching markup (`a[href="/logout"]`) broke both scripts silently when sign-out
became a button.

`waitForSignedIn` also races the login form's error alert against that marker,
so wrong credentials report their message at once. On a timeout it says which
failure happened: *still on the login page* (never got past sign-in) or *marker
not found* (reached the app, but the Sign out button's role or name moved).

## Notes

- Re-run `bun run auth:login` when `screenshots` reports the session expired.
- The origin is, in order: `STACK_BASE_URL` if set; `http://localhost:<PORT>`
  when `PORT` is set; else `https://stack.internal`. The session cookie is
  scoped to the origin you signed in on, so sign in again after changing it.
- Browsers are installed on demand by Playwright; if a run complains about a
  missing browser, run `bunx playwright install chromium`.
- As you add routes, extend `DEFAULT_ROUTES` in `screenshot.mjs` so the no-arg
  sweep covers them.
