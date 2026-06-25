import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/logout")({
  preload: false,
  // Server handler (not a loader) so we can read `request.url` and pass an
  // absolute `returnTo` to WorkOS. Without it, WorkOS falls back to the
  // dashboard's "App homepage URL" (single per env), which clashes between
  // localhost and your deployed origin.
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const origin = new URL(request.url).origin;
        await signOut({ data: { returnTo: `${origin}/` } });
        // signOut throws a redirect, so this is unreachable.
        return new Response(null, { status: 500 });
      },
    },
  },
});
