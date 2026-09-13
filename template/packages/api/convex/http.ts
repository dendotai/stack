import type { GenericCtx } from "@convex-dev/better-auth";
import { httpRouter } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { AUTH_BASE_PATH, createAuth } from "./auth";

// The only routes on this router are Better Auth's (ADR 0004); app-owned
// endpoints live in the web app (ADR 0006).
const http = httpRouter();

declare const process: { env: { CONVEX_SITE_URL?: string } };

// The web proxy carries the front's host and protocol in these headers rather
// than the standard ones, because Convex's edge reads a foreign
// `x-forwarded-host` as a deployment name (get-convex/better-auth#424). Better
// Auth reads the standard pair, so put them back; delete both halves when #424
// closes. The component's own `registerRoutes` does the same thing.
function restoreForwardedHeaders(request: Request): { request: Request; front?: string } {
  const host = request.headers.get("x-better-auth-forwarded-host");
  if (!host) return { request };

  const proto = request.headers.get("x-better-auth-forwarded-proto") ?? "https";
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", proto);
  return { request: new Request(request, { headers }), front: `${proto}://${host}` };
}

// Hand-rolled rather than `authComponent.registerRoutes`, which builds auth
// without the request: the Google redirect is derived from the front that
// started the sign-in, so auth has to be built per request (ADR 0004).
const authRequestHandler = httpAction(async (ctx, incoming) => {
  const { request, front } = restoreForwardedHeaders(incoming);
  return await createAuth(ctx, front).handler(request);
});

http.route({ pathPrefix: `${AUTH_BASE_PATH}/`, method: "GET", handler: authRequestHandler });
http.route({ pathPrefix: `${AUTH_BASE_PATH}/`, method: "POST", handler: authRequestHandler });

// Convex resolves the issuer from the root document; the component's own
// discovery document lives under the auth base path.
http.route({
  path: "/.well-known/openid-configuration",
  method: "GET",
  handler: httpAction(async () =>
    Response.redirect(
      `${process.env.CONVEX_SITE_URL}${AUTH_BASE_PATH}/convex/.well-known/openid-configuration`,
    ),
  ),
});

// Build auth once at module load, so `convex deploy` fails on a missing auth
// variable instead of the first sign-in — the handler above only builds inside
// a request. An empty ctx is safe and is what `registerRoutes` passes here too:
// the adapter stores the ctx and reads it when a query runs, never while
// `betterAuth()` assembles its options.
createAuth({} as GenericCtx<DataModel>);

export default http;
