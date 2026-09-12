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
