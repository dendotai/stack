- **The web app owns the public HTTP surface**
  ([ADR 0006](docs/adr/0006-web-app-owns-public-http-surface.md)): public
  endpoints — a webhook, a capture URL, an API for scripts — are TanStack Start
  server routes in `apps/web` on the project's own domain, and the backend
  package's `convex/http.ts` carries Better Auth's routes and nothing else.
  `CLAUDE.md` states the convention, and ADR 0004 now points at ADR 0006 where
  it cited the upstream issue. No code changes. To apply: copy the ADR and the
  `CLAUDE.md` paragraph.
