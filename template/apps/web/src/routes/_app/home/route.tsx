import { convexQuery } from "@convex-dev/react-query";
import { api } from "@stack/api";
import { createFileRoute } from "@tanstack/react-router";

import { Home } from "./-components/home";

// Placeholder signed-in route. Demonstrates the authed read path end-to-end:
// the loader prefetches the auth-protected query during SSR (root beforeLoad
// has already attached the session token to the SSR client), and the component
// reads it via the same convexQuery key. Build your app by replacing this.
export const Route = createFileRoute("/_app/home")({
  component: Home,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(convexQuery(api.users.getCurrent, {}));
  },
});
