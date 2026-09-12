import { forwardToConvexSite } from "./auth-forward";
import { convexSiteUrl } from "./convex";

// Better Auth serves its endpoints from the Convex deployment's HTTP router
// (ADR 0004). This proxy puts all of them on the app's own origin, so session
// cookies are first-party and the browser never leaves the project's domain.
//
// The target is an argument and never a build variable, so a deployed app can
// only proxy auth to the deployment it already queries. To change it for good,
// change `convexSiteUrl` itself: the session lookup reads that constant too,
// and a proxy pointed somewhere the lookup isn't would sign a visitor in and
// then render every page signed out.
export function createAuthProxy(opts?: { convexSiteUrl: string }) {
  const target = opts?.convexSiteUrl ?? convexSiteUrl;

  return async function proxy({ request }: { request: Request }): Promise<Response> {
    const url = new URL(request.url);

    return await fetch(`${target}${url.pathname}${url.search}`, {
      method: request.method,
      headers: forwardToConvexSite(request.headers, url, target),
      body: request.body,
      // Better Auth's OAuth endpoints answer with 302s the browser must follow
      // itself, so the proxy passes them through rather than chasing them.
      redirect: "manual",
      // Required by fetch to stream a request body.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
  };
}
