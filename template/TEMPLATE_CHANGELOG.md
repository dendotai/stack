# Template changelog

Versioned history of the `dendotai/stack` template. A project created from this
template records the version it started from (see `VERSION`); to pull later
template improvements, an agent reads the entries **newer** than that version and
applies them to the project. See [README → Updating a project](README.md#updating-a-project-from-the-template).

The version in `VERSION` is the template's own version. A fresh project keeps
`VERSION` as the marker of "last template version applied" — bump it as you apply
entries.

Format: [Keep a Changelog](https://keepachangelog.com/), semver. Each entry says
**what changed** and, when an update isn't a clean file copy, **how to apply it**
to an existing project (the manual steps an agent should take).

## [Unreleased]

- **Google sign-in on the project's own OAuth clients** (`packages/api`,
  `apps/web`, [ADR 0004](docs/adr/0004-identity-plane-better-auth-in-convex.md)):
  `convex/auth.ts` enables the Google social provider from `GOOGLE_CLIENT_ID`
  and `GOOGLE_CLIENT_SECRET`, both required, so a push without them fails.
  `convex/http.ts` no longer calls `authComponent.registerRoutes`: it serves
  the same routes hand-rolled and builds auth **per request**, because the
  Google redirect is derived from the front that started the sign-in. One
  deployment can now serve several fronts — `AUTH_TRUSTED_ORIGINS` lists the
  ones `SITE_URL` does not name, and `googleRedirectURI` picks the redirect
  from the forwarded front host, but only from a front already trusted. A
  trusted front may override it with `GOOGLE_REDIRECT_URI`, which is how the
  local devsite host works: Google refuses a `.internal` redirect URI, so it
  borrows a public hostname that Cloudflare 302s back inward. The login page
  gains a "Continue with Google" button that passes the return path as
  `callbackURL`. `docs/SETUP.md` gains §3 — the Google Cloud project, the
  per-environment OAuth clients, and the Cloudflare redirect hop (DNS record,
  redirect rule, token scope) — and its prod gotchas now cover the prod client
  as a promotion-time step (#26). To apply: copy `convex/auth.ts`,
  `convex/http.ts` and `apps/web/src/routes/login.tsx`, then follow
  `docs/SETUP.md` §3 and set the new deployment variables from §2.

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

- **Identity plane on Better Auth inside the Convex deployment** (`packages/api`,
  [ADR 0004](docs/adr/0004-identity-plane-better-auth-in-convex.md)): the
  `@convex-dev/better-auth` component is registered (`convex/convex.config.ts`),
  `convex/auth.ts` enables email + password with a per-deployment
  `AUTH_DISABLE_SIGNUP` flag and exposes it as `auth.signUpDisabled`, and
  `convex/http.ts` serves the component's routes under `/api/auth/` and nothing
  else. The `users` table replaces `workosId` (+ `by_workosId`) with an optional
  `authUserId` (+ `by_authUserId`, `by_email`); the app row is written from the
  component's `user.onCreate` trigger (`users.createFromAuthUser`), linking to an
  unlinked row by **verified** email only. `users.getOrCreate` and the WorkOS
  `customJwt` providers are gone; `auth.config.ts` trusts only the component's
  issuer. A push without `BETTER_AUTH_SECRET` or `SITE_URL` on the deployment
  fails. The web app still carries the vendor login until the next entry; its
  callback no longer upserts the user. To apply: add the two dependencies at the
  pinned versions, copy the six `convex/` files, run `bunx convex env set` for the
  variables in `docs/SETUP.md` §2, then `bunx convex dev --once` to install the
  component and regenerate `_generated/`.

- **Biome config matched to the installed CLI:** `biome.json` now declares
  schema 2.5.1 (the version `bun.lock` installs) and uses `preset:
  "recommended"` instead of the deprecated `recommended: true`.
  `@biomejs/biome` is pinned exactly (`2.5.1`, no caret) so a non-frozen
  `bun install` cannot pull a newer CLI than the schema. To apply: pin
  `@biomejs/biome` to an exact version in the root `package.json`, run
  `bun install`, then `bunx biome migrate --write` and commit all three files.

- **Repo layout:** the template now lives in `template/` of `dendotai/stack`;
  the repo root is an outer monorepo for the site and tooling. Nothing in the
  template tree changed, and file paths in the entries below stay relative to
  the template (i.e. to `template/` in the source repo). Copy `template/` out
  to start a project; GitHub's "Use this template" button is gone.

## [1.0.0] — 2026-06-26

Initial extraction from a production app running on this stack. A minimal,
prod-verified authed skeleton:

- **Monorepo:** bun workspaces (`apps/*`, `packages/*`), Biome, shared
  `tsconfig.base.json`. `apps/mobile/` is a README-only placeholder for a future
  Expo app.
- **Web (`apps/web`):** TanStack Start on Cloudflare Workers (`@cloudflare/vite-plugin`),
  Tailwind v4 + shadcn/ui base, `@convex-dev/react-query` reads. Routes: landing
  (`/`), `/login`, `/logout`, `/api/auth/callback`, and one placeholder signed-in
  route (`/home`) demonstrating the authed read path end-to-end.
- **Auth:** WorkOS AuthKit (`@workos/authkit-tanstack-react-start`) — `authkitMiddleware`
  in `src/start.ts`, `AuthKitProvider` + `ConvexProviderWithAuth`, default-deny
  route gate (`src/lib/auth-gate.ts`), SSR token prefetch in the root `beforeLoad`.
- **Backend (`packages/api`):** Convex with a `users` table, `users.getOrCreate`
  (called from the auth callback) + `users.getCurrent`, the `authedQuery`/
  `authedMutation` seam, `auth.config.ts` (WorkOS customJwt, two issuers), and the
  Convex ai-files (`convex.json`, `.claude/skills`).
- **CI/CD:** GitHub Actions `ci.yml` (lint + typecheck + test + build) and
  `deploy.yml` (Convex deploy → Worker build → Worker deploy, per-environment
  Variables/Secrets split).
- **Docs:** `README.md`, `docs/SETUP.md` (external setup + prod-cutover gotchas),
  ADRs (`0002` route-scoped hooks, `0003` Convex ai-files).
