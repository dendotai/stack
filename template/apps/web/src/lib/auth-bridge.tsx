import { type AuthClient, ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { authClient } from "./auth-client";
import { convex } from "./convex";

// `initialToken` is what the root route resolved on the server, so the first
// client render is already authenticated.
//
// With no token there is no session, and the Better Auth provider would still
// fetch one on mount — a round trip an anonymous visitor on a public page must
// not pay. The plain provider gives those pages an unauthenticated Convex
// client and nothing else. Signing in navigates the whole document, so this
// branch is decided once per page load.
export function ConvexAuthProvider({
  initialToken,
  children,
}: {
  initialToken: string | null;
  children: ReactNode;
}) {
  if (!initialToken) return <ConvexProvider client={convex}>{children}</ConvexProvider>;

  return (
    <ConvexBetterAuthProvider
      client={convex}
      // get-convex/better-auth#420: the provider's `AuthClient` type does not
      // match what `createAuthClient` returns for the same plugin set. Drop the
      // cast when that issue closes.
      authClient={authClient as unknown as AuthClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
