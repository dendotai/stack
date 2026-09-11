import { createFileRoute } from "@tanstack/react-router";
import { convexSiteUrl } from "../../../lib/convex";

// Better Auth serves its endpoints from the Convex deployment's HTTP router
// (ADR 0004). This proxy puts all of them on the app's own origin, so session
// cookies are first-party and the browser never leaves the project's domain.
async function proxy({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);

  // Hop-by-hop headers describe the inbound connection; forwarding them makes
  // the outbound fetch reject the body.
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  // get-convex/better-auth#424: Convex's edge reads a foreign
  // `x-forwarded-host` as a deployment name and answers 404, so the front's
  // host and protocol travel in the component's own headers instead. Delete
  // this block when that issue closes.
  headers.delete("forwarded");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.set("x-better-auth-forwarded-host", url.host);
  headers.set("x-better-auth-forwarded-proto", url.protocol.replace(/:$/, ""));

  headers.set("host", new URL(convexSiteUrl).host);
  // An encoded response would reach the browser with the header the runtime
  // already stripped while decoding it.
  headers.set("accept-encoding", "identity");

  return await fetch(`${convexSiteUrl}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
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
