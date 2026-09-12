import { getToken } from "@convex-dev/better-auth/utils";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionCookie } from "better-auth/cookies";
import { forwardToConvexSite } from "./auth-forward";
import { convexSiteUrl } from "./convex";

// Exchanges the Better Auth session cookie for the JWT Convex validates. Runs
// on the server because only the server sees that cookie: it is HttpOnly.
const fetchSessionToken = createServerFn({ method: "GET" }).handler(
  async (): Promise<string | null> => {
    const request = getRequest();
    // Without a session cookie the endpoint can only answer "no session", so an
    // anonymous visitor must not pay the round trip to the deployment.
    if (!getSessionCookie(request.headers)) return null;
    const headers = forwardToConvexSite(request.headers, new URL(request.url));
    const { token } = await getToken(convexSiteUrl, headers);
    return token ?? null;
  },
);

let pending: Promise<string | null> | undefined;

// Router preloads can start several root `beforeLoad` runs at once; one shared
// promise keeps a page load to a single request. Cached on the client only — on
// the server this module is shared by every concurrent render, so a cached
// token would be handed to the wrong visitor.
export function getSessionToken(): Promise<string | null> {
  if (typeof window === "undefined") return fetchSessionToken();
  pending ??= fetchSessionToken();
  return pending;
}
