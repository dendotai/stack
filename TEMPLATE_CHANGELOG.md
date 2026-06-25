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
