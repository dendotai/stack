import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// No `baseURL`: the client calls the app's own origin, where `/api/auth/$`
// proxies to the deployment. Auth cookies stay first-party (ADR 0004).
export const authClient = createAuthClient({ plugins: [convexClient()] });
