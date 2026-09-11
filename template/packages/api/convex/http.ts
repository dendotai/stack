import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createAuth } from "./auth";

// The only routes on this router are Better Auth's (ADR 0004); app-owned
// endpoints live in the web app.
const http = httpRouter();

const BASE_PATH = "/api/auth";

declare const process: { env: { CONVEX_SITE_URL?: string } };

// The web proxy carries the front's host and protocol in these headers rather
// than the standard ones, because Convex's edge reads a foreign
// `x-forwarded-host` as a deployment name (get-convex/better-auth#424).
function frontOrigin(request: Request): string | undefined {
  const host = request.headers.get("x-better-auth-forwarded-host");
  if (!host) return undefined;
  const proto = request.headers.get("x-better-auth-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Better Auth reads the standard headers, so restore them once the front is
// known. Delete this hand-off with #424; the component's own `registerRoutes`
// does the same thing.
function withForwardedHeaders(request: Request, front: string): Request {
  const url = new URL(front);
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(/:$/, ""));
  return new Request(request, { headers });
}

// Hand-rolled rather than `authComponent.registerRoutes`, which builds auth
// without the request: the Google redirect is derived from the front that
// started the sign-in, so auth has to be built per request (ADR 0004).
const authRequestHandler = httpAction(async (ctx, request) => {
  const front = frontOrigin(request);
  const auth = createAuth(ctx, front);
  return await auth.handler(front ? withForwardedHeaders(request, front) : request);
});

http.route({ pathPrefix: `${BASE_PATH}/`, method: "GET", handler: authRequestHandler });
http.route({ pathPrefix: `${BASE_PATH}/`, method: "POST", handler: authRequestHandler });

// Convex resolves the issuer from the root document; the component's own
// discovery document lives under the auth base path.
http.route({
  path: "/.well-known/openid-configuration",
  method: "GET",
  handler: httpAction(async () =>
    Response.redirect(
      `${process.env.CONVEX_SITE_URL}${BASE_PATH}/convex/.well-known/openid-configuration`,
    ),
  ),
});

// Build auth once here, at module load, so `convex deploy` fails on a missing
// auth variable instead of the first sign-in. `registerRoutes` used to do this;
// the handler above only builds inside a request.
createAuth({} as Parameters<typeof createAuth>[0]);

export default http;
