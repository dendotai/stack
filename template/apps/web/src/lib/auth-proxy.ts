import { forwardToConvexSite } from "./auth-forward";
import { convexSiteUrl } from "./convex";

// Better Auth serves its endpoints from the Convex deployment's HTTP router
// (ADR 0004). This proxy puts all of them on the app's own origin, so session
// cookies are first-party and the browser never leaves the project's domain.
//
// The target is a parameter and never a build variable, so a deployed app can
// only proxy auth to the deployment it already queries. A project whose two
// hosts don't follow the `.convex.cloud` → `.convex.site` swap passes its own
// here; nothing reads one from the environment.
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
