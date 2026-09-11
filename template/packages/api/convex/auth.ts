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
  env: {
    BETTER_AUTH_SECRET?: string;
    SITE_URL?: string;
    AUTH_DISABLE_SIGNUP?: string;
    AUTH_TRUSTED_ORIGINS?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
  };
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
function required(
  name: "BETTER_AUTH_SECRET" | "SITE_URL" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET",
): string {
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

// One deployment can serve more than one front, but `baseURL` names only one of
// them. Every other front's `Origin` fails the CSRF check unless it is listed
// here. Dev lists the local devsite host; prod has a single front and lists
// nothing.
const trustedOrigins = (): string[] =>
  (process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

// Better Auth's own default, named here because http.ts routes it and the
// Google callback hangs off it.
export const AUTH_BASE_PATH = "/api/auth";

const GOOGLE_CALLBACK_PATH = `${AUTH_BASE_PATH}/callback/google`;

const siteOrigin = () => new URL(required("SITE_URL")).origin;

/**
 * The `redirect_uri` Google is told to send the browser back to, for the front
 * that started this sign-in.
 *
 * @param front - origin of the front that started the sign-in, from the
 *   forwarded headers the web proxy sets; `undefined` when a request arrives
 *   without them.
 */
export function googleRedirectURI(front: string | undefined): string {
  const base = siteOrigin();

  // The base front can always name itself, so the override below is never its
  // business — not even when a deployment also lists it as a trusted origin.
  if (!front || front === base) return `${base}${GOOGLE_CALLBACK_PATH}`;

  // A front this deployment does not trust never chooses the redirect: the
  // value travels to Google as `redirect_uri` and decides where the
  // authorization code is delivered, so an unchecked forwarded host would let a
  // caller aim the code at a host of its choosing.
  if (!trustedOrigins().includes(front)) return `${base}${GOOGLE_CALLBACK_PATH}`;

  // Google refuses a redirect URI on a non-public TLD, so the local devsite
  // front cannot name itself. `GOOGLE_REDIRECT_URI` names a public hop host
  // instead, which Cloudflare 302s back to the devsite with the path and query
  // intact (docs/SETUP.md §3). One value covers every trusted front, so a
  // deployment that trusts a second *public* front leaves it unset and lets
  // each front name itself.
  return process.env.GOOGLE_REDIRECT_URI ?? `${front}${GOOGLE_CALLBACK_PATH}`;
}

// Better Auth runs here, in the Convex runtime, rather than in the web Worker —
// see ADR 0004. `front` comes from the request, so the router rebuilds auth per
// request; everything else is deployment config.
export const createAuth = (ctx: GenericCtx<DataModel>, front?: string) =>
  betterAuth({
    baseURL: required("SITE_URL"),
    secret: required("BETTER_AUTH_SECRET"),
    database: authComponent.adapter(ctx),
    trustedOrigins: trustedOrigins(),
    // disableSignUp refuses new registrations only — existing email/password
    // users keep signing in. Per-deployment so a private deployment admits
    // only the users it already has.
    emailAndPassword: { enabled: true, disableSignUp: signUpDisabledFlag() },
    socialProviders: {
      google: {
        clientId: required("GOOGLE_CLIENT_ID"),
        clientSecret: required("GOOGLE_CLIENT_SECRET"),
        // Wins over the derived default in both the authorization URL and the
        // code exchange, which is what lets one client serve two fronts.
        redirectURI: googleRedirectURI(front),
      },
    },
    plugins: [convex({ authConfig })],
  });
