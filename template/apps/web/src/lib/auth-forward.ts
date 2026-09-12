import { convexSiteUrl } from "./convex";

// Rewrites inbound request headers for a call to the deployment's HTTP router.
// Both callers send the visitor's own cookies there — the `/api/auth/$` proxy
// and the session-token lookup — so both need the same rewrite.
//
// `front` is the origin the visitor is actually on. `siteUrl` follows whatever
// target its caller was built with, so a proxy pointed elsewhere still sends a
// matching `host`.
export function forwardToConvexSite(
  inbound: Headers,
  front: URL,
  siteUrl: string = convexSiteUrl,
): Headers {
  const headers = new Headers(inbound);

  // Hop-by-hop headers describe the inbound connection; forwarding them makes
  // the outbound fetch reject the body.
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  // get-convex/better-auth#424: Convex's edge reads a foreign
  // `x-forwarded-host` as a deployment name and answers 404, and a Worker gets
  // these headers from Cloudflare on every request. The component restores both
  // from its own headers once inside the Convex runtime, so the front's host
  // and protocol travel there instead. Delete this block when that issue closes.
  headers.delete("forwarded");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.set("x-better-auth-forwarded-host", front.host);
  headers.set("x-better-auth-forwarded-proto", front.protocol.replace(/:$/, ""));

  headers.set("host", new URL(siteUrl).host);
  // An encoded response would reach the caller carrying a `content-encoding`
  // the runtime already stripped while decoding it.
  headers.set("accept-encoding", "identity");

  return headers;
}
