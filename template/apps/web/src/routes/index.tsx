import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  // The root route already resolved the session; reading its context keeps the
  // landing page off a second round trip.
  beforeLoad: ({ context }) => {
    if (context.sessionToken) throw redirect({ to: "/home" });
  },
  component: Landing,
});

export function Landing() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">stack</h1>
        <p className="text-muted-foreground text-lg">
          A minimal authed starter — TanStack Start on Cloudflare Workers, Convex, Better Auth.
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
