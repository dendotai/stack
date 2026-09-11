import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute({
        onError: ({ error, request }) => {
          console.error("WorkOS auth callback failed:", error);
          return Response.redirect(new URL("/?error=auth_failed", request.url));
        },
      }),
    },
  },
});
