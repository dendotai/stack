import { convexQuery } from "@convex-dev/react-query";
import { api } from "@stack/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authClient } from "../../../lib/auth-client";

type Mode = "signIn" | "signUp";

export function LoginPage({ returnPath }: { returnPath: string }) {
  // Server render and first client render must agree, so this starts false and
  // flips in a mount effect. Until it flips, every submit control is disabled:
  // before hydration the browser runs the form's own submission, and a password
  // in a GET query string lands in history, the Referer header and access logs
  // (#28). `method="post"` below is the backstop for whatever still slips
  // through, e.g. implicit submission with Enter. Any social sign-in button
  // added to this page takes the same flag.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [mode, setMode] = useState<Mode>("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `undefined` while the query is in flight. The create-account control stays
  // hidden then, so a closed deployment never flashes a sign-up a visitor
  // cannot complete.
  const { data: signUpDisabled } = useQuery(convexQuery(api.auth.signUpDisabled, {}));
  const canSignUp = signUpDisabled === false;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const result =
      mode === "signUp"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name") ?? "") })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Check your details and try again.");
      setSubmitting(false);
      return;
    }
    // A full navigation, not a router navigate: the root route resolves the
    // session on the server, so the new cookie has to ride a fresh document
    // request for the destination to render signed-in.
    window.location.href = returnPath;
  }

  // Better Auth answers with a 302 to Google, so nothing here navigates: the
  // browser leaves on its own and comes back to `callbackURL`. A path, not a
  // URL, so the deployment returns the visitor to the front that started the
  // sign-in — dev serves two of them against one deployment (ADR 0004).
  async function onGoogleSignIn() {
    setError(null);
    setSubmitting(true);
    const result = await authClient.signIn.social({ provider: "google", callbackURL: returnPath });
    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed. Try again.");
      setSubmitting(false);
    }
  }

  const submitLabel = mode === "signUp" ? "Create account" : "Sign in";

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "signUp" ? "Create your account" : "Sign in"}
        </h1>

        <form method="post" onSubmit={onSubmit} className="space-y-4">
          {mode === "signUp" && (
            <div className="space-y-1">
              <label htmlFor="name" className="block text-sm font-medium">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!hydrated || submitting}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={!hydrated || submitting}
          className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Continue with Google
        </button>

        {canSignUp && (
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => {
              setError(null);
              setMode(mode === "signUp" ? "signIn" : "signUp");
            }}
            className="text-sm underline underline-offset-4 disabled:opacity-50"
          >
            {mode === "signUp" ? "Back to sign in" : "Sign up"}
          </button>
        )}
      </div>
    </main>
  );
}
