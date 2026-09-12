- **Web login on the project's own domain** (`apps/web`,
  [ADR 0004](docs/adr/0004-identity-plane-better-auth-in-convex.md)): the app
  serves its own email-and-password form at `/login`, and
  `src/routes/api/auth/$.tsx` proxies every Better Auth endpoint to the
  deployment's site URL, derived from `VITE_CONVEX_URL` with no second
  variable, so sessions are first-party.
  `src/lib/auth-session.ts` resolves the session once per page load in a server
  function that returns early without a session cookie; the root route puts the
  token on the route context, hands it to the Convex SSR client, and drives the
  nav from it. An anonymous visitor on a public page makes no auth request at
  all: with no token the bridge mounts the plain Convex provider instead of the
  Better Auth one. Sign-out is a **button** named "Sign out" that clears the
  query cache. The login form declares `method="post"` and disables its submit
  until a mount effect marks hydration, so a submit in that window cannot put a
  password in the URL (#28); `src/routes/login.test.tsx` asserts both on the
  server-rendered markup. The screenshot scripts detect a signed-in session by
  that button's role and name, defined once in `scripts/selectors.mjs`, and
  report "still on the login page" or "marker not found" instead of a bare
  timeout (#30). Removed: `@workos/authkit-tanstack-react-start`, the
  `authkitMiddleware` in `src/start.ts`, the `/logout` and
  `/api/auth/callback` routes, the Vite `optimizeDeps` workaround, the CI build
  stubs, and the four WorkOS values in `deploy.yml` — the worker now takes only
  `CONVEX_URL`. To apply: copy `apps/web/src/` and `apps/web/scripts/`, swap the
  dependency for `better-auth` + `@convex-dev/better-auth` at the pinned
  versions, drop the WorkOS secrets from your GitHub environments and
  `.dev.vars`, and set `SITE_URL` on each Convex deployment to that
  environment's web origin.
