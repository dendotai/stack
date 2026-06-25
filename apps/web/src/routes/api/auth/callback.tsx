import { api } from "@stack/api";
import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";
import { ConvexHttpClient } from "convex/browser";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute({
        onSuccess: async ({ accessToken, user }) => {
          const url = import.meta.env.VITE_CONVEX_URL;
          if (!url) {
            console.error("VITE_CONVEX_URL not set; skipping user upsert");
            return;
          }
          const convex = new ConvexHttpClient(url);
          convex.setAuth(accessToken);
          const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ");
          await convex.mutation(api.users.getOrCreate, {
            email: user.email,
            name: displayName || undefined,
          });
        },
        onError: ({ error, request }) => {
          console.error("WorkOS auth callback failed:", error);
          return Response.redirect(new URL("/?error=auth_failed", request.url));
        },
      }),
    },
  },
});
