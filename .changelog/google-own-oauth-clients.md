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
