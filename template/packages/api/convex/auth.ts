import { type AuthFunctions, createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
// biome-ignore lint/style/noRestrictedImports: signUpDisabled is read by the login form — its caller is by definition signed out, so the auth seam can't apply.
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { createFromAuthUser } from "./users";

declare const process: {
  env: { BETTER_AUTH_SECRET?: string; SITE_URL?: string; AUTH_DISABLE_SIGNUP?: string };
};

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: { onCreate: async (ctx, doc) => await createFromAuthUser(ctx, doc) },
  },
});

// The component calls these back in the app's own transaction; `authFunctions`
// above is how it finds them, so the export and the reference must agree.
export const { onCreate } = authComponent.triggersApi();

// http.ts initializes auth at push time, so throwing here fails the push rather
// than the first login. Worth the noise for the secret especially: Better Auth
// otherwise falls back to a constant published in its own source, refusing only
// when NODE_ENV === "production" — which the Convex runtime does not guarantee,
// so a prod deployment could sign sessions anyone can forge.
function required(name: "BETTER_AUTH_SECRET" | "SITE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set on this Convex deployment`);
  return value;
}

const signUpDisabledFlag = () => process.env.AUTH_DISABLE_SIGNUP === "true";

// The login form reads this to hide its create-account control — same source of
// truth the sign-up endpoint enforces, so the UI can't drift from the gate.
export const signUpDisabled = query({
  args: {},
  handler: async (): Promise<boolean> => signUpDisabledFlag(),
});

// Better Auth runs here, in the Convex runtime, rather than in the web Worker —
// see ADR 0004.
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: required("SITE_URL"),
    secret: required("BETTER_AUTH_SECRET"),
    database: authComponent.adapter(ctx),
    // disableSignUp refuses new registrations only — existing email/password
    // users keep signing in. Per-deployment so a private deployment admits
    // only the users it already has.
    emailAndPassword: { enabled: true, disableSignUp: signUpDisabledFlag() },
    plugins: [convex({ authConfig })],
  });
