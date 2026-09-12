# 0004. Identity plane: Better Auth inside the Convex deployment

**Status:** Accepted

## Context

The template shipped a hosted-login vendor (WorkOS AuthKit). Every project
started from it inherited a browser hop to the vendor's domain, a Google
consent screen naming the vendor, a hosted page whose locale could not be
pinned, and three vendor secrets plus a redirect variable per environment.
Serving login on the project's own domain is a paid add-on there. A
downstream project on this stack replaced the vendor with first-party login
and proved the shape end to end; this ADR records the shape and the choices
inside it that will look wrong later.

Three of those choices have a tempting alternative:

- **Run Better Auth in the web Worker**, next to the app that serves the form.
  One hop shorter, one process to reason about.
- **Enable Better Auth's OAuth-provider plugin**, so the same library issues
  tokens for extensions, MCP, and API clients.
- **Register the auth routes on the web app** like every other public endpoint,
  since the template's convention (#38) is that the web app owns the public
  HTTP surface and the backend package exposes no HTTP router.

## Decision

**Better Auth runs inside the Convex deployment, through
`@convex-dev/better-auth`, unmodified from npm.** Convex is the only datastore
for users and sessions. The app's `users` row is written from the component's
`user.onCreate` trigger, inside the same transaction as the component's own
insert, so an app row can never be missing for an auth user that exists. The
`authUserId` on that row is the only link between the two, and the identity's
`subject` in every Convex function is that same id.

**Not in the Worker.** `better-auth/better-auth#10315` is an init hang specific
to Cloudflare Workers, with production confirmations, and the downstream
project hit it. The Convex runtime does not have that failure mode. A future
refactor that proposes moving auth into the Worker "to remove a hop" is
undoing this.

**Only the component's own `convex` plugin. No OAuth-provider plugin.** The
downstream project built the single-library path first and it did not hold:
refresh-token rotation fails on the first rotation against the component's
adapter, an unpatched audience-binding advisory rides every stable version,
and the component's own test suite covers none of the OAuth surface. Token
issuance for non-browser clients is the *authorization plane* and is a separate
decision (#35). This ADR covers sign-in, sessions, and users only.

**The Convex HTTP router exists, and it serves only Better Auth's routes.** The
component's request handler must run in the Convex runtime (above), and Better
Auth is an HTTP protocol, so a router in `convex/http.ts` is the only way in.
Everything else stays where #38 puts it: the web app proxies the auth path to
this router on its own domain, and app-owned endpoints never land here. The
convention's wording is therefore "**no app-owned endpoints on the Convex
router**", and this router is not an exception to it. The routes are
hand-rolled rather than taken from the component's own `registerRoutes`: that
call builds auth without the request, and the Google redirect has to be derived
from the front that started the sign-in. `convex/http.ts` therefore carries the
same three routes — the `/api/auth/` prefix for GET and POST, plus the root
`/.well-known/openid-configuration` redirect Convex needs to resolve the issuer
— and builds auth per request. It also builds auth once at module load, which
is what keeps a missing variable a push failure.

**One deployment serves several fronts, and each sign-in returns to its own.**
`SITE_URL` names one front; every other front is listed in
`AUTH_TRUSTED_ORIGINS` and would otherwise fail the CSRF origin check. Dev uses
this for its two fronts — the deployed dev host and the local devsite host —
against one deployment. The Google redirect is chosen per request from the
forwarded front host, and only from a front already trusted, because that value
reaches Google as `redirect_uri` and decides where the authorization code is
delivered. A trusted front may override it with `GOOGLE_REDIRECT_URI`: Google
refuses a redirect URI on a non-public TLD, so the local devsite host borrows a
public hostname that Cloudflare 302s back to it (docs/SETUP.md §3). Better
Auth's post-callback redirect is a path, so the browser resolves it against
whichever front it is on, with no further configuration.

**Linking is gated on a verified email.** A new auth user links to an existing
unlinked `users` row with the same email only when the identity provider
reports the email as verified; an unverified email always inserts a new row,
and a row that already carries an `authUserId` is never re-linked. Without the
gate, anyone signing up with a known address would claim that account.

**Every required auth variable fails the push, not the first login.** The
secret, the site URL and the Google client id and secret are read through a
helper that throws when unset, and the router builds auth once at module load,
so `convex deploy` refuses a deployment missing any of them. Better Auth
otherwise falls back to a constant published in its own source and refuses it
only when `NODE_ENV === "production"`, which the Convex runtime does not
guarantee.

## Consequences

- **Positive:** login, cookies, and Google's consent screen see only the
  project's domain; one vendor and four per-environment values drop out of
  provisioning; the app row is transactional with the auth user, so no
  protected function ever runs without one.
- **Accepted trade-off:** the web app derives the router's host from
  `VITE_CONVEX_URL` by the `.convex.cloud` → `.convex.site` swap, and takes no
  second build variable, so a deployed build can never proxy auth to a
  deployment it does not query. A paid plan's custom router domain breaks that
  swap: `convexSiteUrl` in `apps/web/src/lib/convex.ts` is then the one line to
  change, and both the proxy and the session lookup follow it.
- **Accepted trade-off:** the auth path crosses two runtimes (Worker proxy →
  Convex router) on every request. The proxy is a few lines and the
  session lookup runs once per page load, gated on the presence of a cookie.
- **Accepted trade-off:** two open upstream issues in the component force
  hand-rolled code that should be deleted when they close:
  - `get-convex/better-auth#424` — Convex's edge resolves a foreign
    `x-forwarded-host` as a deployment name and 404s. The web proxy strips the
    standard forwarded headers and carries the front's host and protocol in
    the component's own `x-better-auth-forwarded-*` headers instead.
  - `get-convex/better-auth#420` — the React provider's `AuthClient` type does
    not match what `createAuthClient` returns for the same plugin set. The web
    bridge carries a documented cast until the types agree.
- **Coexistence path for a project with live vendor sessions:** the downstream
  project trusted three issuers at once during its migration — the component's
  plus both vendor issuers in `auth.config.ts` — and let the users trigger link
  the vendor-era rows by verified email at first sign-in. The window collapses
  to one issuer at cutover. The template itself carries no coexistence code;
  it is rebuilt as if the vendor never existed.
- **Open:** the authorization plane (#35). Whatever issues tokens for token
  clients must present them to Convex as a second trusted issuer with an
  `applicationID` other than `"convex"`, because the component's plugin
  resolves its own provider by that id and throws on a duplicate.
