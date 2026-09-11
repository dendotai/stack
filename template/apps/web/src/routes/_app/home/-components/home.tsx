import { convexQuery } from "@convex-dev/react-query";
import { api } from "@stack/api";
import { useQuery } from "@tanstack/react-query";

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
