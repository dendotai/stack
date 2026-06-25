import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const auth = await getAuth();
    if (auth.user) {
      throw redirect({ to: "/home" });
    }
  },
  component: Landing,
});

export function Landing() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">stack</h1>
        <p className="text-muted-foreground text-lg">
          A minimal authed starter — TanStack Start on Cloudflare Workers, Convex, WorkOS.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <a href="/login" className="text-sm underline underline-offset-4">
            Sign in
          </a>
        </div>
      </div>
    </main>
  );
}
