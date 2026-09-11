import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL;
if (!url) throw new Error("VITE_CONVEX_URL is not set");

export const convex = new ConvexReactClient(url);

// Better Auth's endpoints are served by the Convex deployment's own HTTP router
// (ADR 0004), which answers on the deployment's `.convex.site` host. Derived
// from the one URL rather than a second variable, so a deployed app can never
// proxy auth to a different deployment than it queries.
//
// A local Convex backend serves HTTP actions on its own port instead, so
// `VITE_CONVEX_SITE_URL` — which `convex dev` writes next to `VITE_CONVEX_URL`
// — overrides the derivation when it is set.
export const convexSiteUrl =
  import.meta.env.VITE_CONVEX_SITE_URL || url.replace(/\.convex\.cloud$/, ".convex.site");
