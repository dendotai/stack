import { convexQuery } from "@convex-dev/react-query";
import { api } from "@stack/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

// Placeholder signed-in route. Demonstrates the authed read path end-to-end:
// the loader prefetches the auth-protected query during SSR (root beforeLoad
// has already attached the WorkOS token to the SSR client), and the component
// reads it via the same convexQuery key. Build your app by replacing this.
export const Route = createFileRoute("/_app/home")({
  component: Home,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(convexQuery(api.users.getCurrent, {}));
  },
});

export function Home() {
  const { data: user, isPending } = useQuery(convexQuery(api.users.getCurrent, {}));

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const name = user?.name ?? user?.email ?? "there";

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight">Hello, {name}</h1>
      <p className="text-muted-foreground">
        You're signed in. This is your placeholder home route — start building here.
      </p>
    </div>
  );
}
