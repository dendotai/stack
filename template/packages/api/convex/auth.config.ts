import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

// Exactly one trusted issuer: the Better Auth component's (ADR 0004). The
// component's `convex` plugin finds its provider by `applicationID === "convex"`
// and throws when more than one matches, so no provider added here may reuse
// that applicationID.
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
