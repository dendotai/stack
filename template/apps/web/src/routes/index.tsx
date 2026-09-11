import { createFileRoute, redirect } from "@tanstack/react-router";

import { Landing } from "./-components/landing";

export const Route = createFileRoute("/")({
  // The root route already resolved the session; reading its context keeps the
  // landing page off a second round trip.
  beforeLoad: ({ context }) => {
    if (context.sessionToken) throw redirect({ to: "/home" });
  },
  component: Landing,
});
