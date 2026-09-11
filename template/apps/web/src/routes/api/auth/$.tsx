import { createFileRoute } from "@tanstack/react-router";
import { forwardToConvexSite } from "../../../lib/auth-forward";
import { convexSiteUrl } from "../../../lib/convex";

// Better Auth serves its endpoints from the Convex deployment's HTTP router
// (ADR 0004). This proxy puts all of them on the app's own origin, so session
// cookies are first-party and the browser never leaves the project's domain.
async function proxy({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);

  return await fetch(`${convexSiteUrl}${url.pathname}${url.search}`, {
    method: request.method,
    headers: forwardToConvexSite(request.headers, url),
    body: request.body,
    // Better Auth's OAuth endpoints answer with 302s the browser must follow
    // itself, so the proxy passes them through rather than chasing them.
    redirect: "manual",
    // Required by fetch to stream a request body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: proxy, POST: proxy } },
});
