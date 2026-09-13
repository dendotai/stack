# 0006. The web app owns the public HTTP surface

**Status:** Accepted

## Context

Sooner or later a project needs a public HTTP endpoint that is not a page:
a capture endpoint called from a script, a webhook receiver, an API for
token clients. Convex's own answer is the tempting one: a router in
`convex/http.ts` built from `httpAction`s, served on the deployment's
`*.convex.site` host. It is the documented pattern, the handler runs next to
the data it writes, and the request makes one hop instead of two.

The template already carries a `convex/http.ts`, because Better Auth has to
run in the Convex runtime and is an HTTP protocol
([ADR 0004](0004-identity-plane-better-auth-in-convex.md)). A new endpoint
added to that file would look like the natural extension of what is there.
A downstream project evaluated exactly that and ruled it out; this ADR
records the rule so each derived project does not decide it again.

## Decision

**Public endpoints are TanStack Start server routes in `apps/web`, served
from the project's own domain.** The backend package's public surface is the
Convex function API alone. Its HTTP router carries no app-owned endpoint: the
only routes on it are the Better Auth component's, which the web app proxies
onto its own domain, and the root discovery redirect Convex needs. That
router is a runtime constraint of ADR 0004, not a place to grow from.

A server route that needs the backend calls Convex functions through the
Convex client, the same way a page loader does. An endpoint that needs a
token-client identity is the authorization plane (#35) and is layered on the
web app too.

Three reasons, and each one alone would decide it:

- **The domain.** `*.convex.site` is a host the project does not control.
  Nothing can be put in front of it: no WAF, no rate limiter, no redirect,
  no custom error page, no access rule. The web Worker sits behind
  Cloudflare on the project's own domain, and every one of those is a
  dashboard setting there.
- **One security posture.** Auth-adjacent routes already live in the web
  Worker: the auth proxy today, the OAuth callback and token endpoints and
  the MCP endpoint if the project grows them (#35). A second public surface
  on the backend package would need its own CORS, error shape, abuse
  handling and logging, separate from the ones the web app already has, and
  the two would drift.
- **One front door.** Every caller, browser or script, reaches the project
  at one origin. Cookies, CSRF checks and origin allowlists reason about one
  host, and moving a deployment or renaming a host changes one DNS record.

## Consequences

- **Positive:** the whole public surface has one domain, one set of edge
  rules and one error shape. The backend package stays a function API, which
  is what its tests and its auth model already cover.
- **Accepted trade-off:** a public endpoint that writes data crosses two
  runtimes (Worker → Convex function) instead of one. The auth path already
  takes the same two hops (ADR 0004).
- **Accepted trade-off:** a webhook sender or a script sees the web app's
  domain, so the web Worker must be deployed for the endpoint to exist. A
  backend-only deployment cannot serve a public endpoint on its own.
- **Open:** a Convex feature that only works through the deployment's own
  router (a storage-serving URL, a Convex-issued webhook target) would need
  a documented exception. None is known today; if one appears, it gets its
  own ADR that names the route and why the web app cannot front it.
