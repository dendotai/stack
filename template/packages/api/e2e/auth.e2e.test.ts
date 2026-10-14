import { afterAll, beforeAll, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { deploy, inlineQuery, query, runFunction, seedTable, setEnv } from "./deployment";
import { type LocalBackend, startBackend } from "./local-backend";

let backend: LocalBackend;

beforeAll(async () => {
  backend = await startBackend();
  await deploy(backend);
});

afterAll(async () => {
  await backend?.stop();
});

const PASSWORD = "correct-horse-battery-staple";

type SignUpResponse = { user?: { id?: string; email?: string } };

async function signUp(email: string, at: LocalBackend = backend) {
  const res = await fetch(`${at.siteUrl}/api/auth/sign-up/email`, {
    method: "POST",
    // Better Auth refuses a POST with no Origin as a CSRF defense; a browser always sends one.
    headers: { "Content-Type": "application/json", Origin: at.siteUrl },
    body: JSON.stringify({ email, password: PASSWORD, name: "Ada" }),
  });
  const body = (await res.json()) as SignUpResponse;
  return { status: res.status, body, cookie: res.headers.get("set-cookie") ?? "" };
}

async function googleRedirectUri(headers: Record<string, string> = {}) {
  const res = await fetch(`${backend.siteUrl}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: backend.siteUrl, ...headers },
    body: JSON.stringify({ provider: "google", callbackURL: "/home" }),
  });
  const body = (await res.json()) as { url?: string };
  expect(res.status, JSON.stringify(body)).toBe(200);
  return new URL(body.url ?? "");
}

const usersByEmail = (email: string) =>
  inlineQuery<Doc<"users">[]>(
    backend,
    `await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", "${email}")).collect()`,
  );

test("email/password sign-up creates a Better Auth user", async () => {
  const { status, body } = await signUp("ada@example.com");

  expect(status, JSON.stringify(body)).toBe(200);
  expect(body.user?.email).toBe("ada@example.com");
});

test("the session cookie from sign-up resolves to that user", async () => {
  const { body, cookie } = await signUp("ada+session@example.com");

  const res = await fetch(`${backend.siteUrl}/api/auth/get-session`, {
    headers: { Cookie: cookie, Origin: backend.siteUrl },
  });
  const session = (await res.json()) as SignUpResponse;

  expect(res.status, JSON.stringify(session)).toBe(200);
  expect(session.user?.id).toBe(body.user?.id);
});

test("sign-up syncs an app users row linked by authUserId", async () => {
  const { body } = await signUp("ada+synced@example.com");

  expect(await usersByEmail("ada+synced@example.com")).toEqual([
    expect.objectContaining({ name: "Ada", authUserId: body.user?.id }),
  ]);
});

test("the JWT the session mints resolves to the synced users row", async () => {
  const { body, cookie } = await signUp("ada+jwt@example.com");

  const res = await fetch(`${backend.siteUrl}/api/auth/convex/token`, {
    headers: { Cookie: cookie, Origin: backend.siteUrl },
  });
  const { token } = (await res.json()) as { token?: string };
  expect(token, `token endpoint returned ${res.status}`).toBeTruthy();

  expect(await query(backend, api.users.getCurrent, {}, { asToken: token })).toMatchObject({
    email: "ada+jwt@example.com",
    authUserId: body.user?.id,
  });
});

test("the deployment trusts the Better Auth issuer and nothing else", async () => {
  // A token from an issuer nobody configured makes Convex list every issuer it does trust, the only view of auth.config.ts from outside.
  const unknownIssuer = [
    { alg: "RS256", typ: "JWT" },
    { iss: "https://nobody.example.com", aud: "convex", sub: "x", exp: 9999999999 },
  ]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".");

  const rejection = await query(
    backend,
    api.users.getCurrent,
    {},
    { asToken: `${unknownIssuer}.sig` },
  ).then(
    () => "",
    (error: Error) => error.message,
  );

  expect(rejection).toContain(`issuer=${backend.siteUrl}`);
  expect(rejection.match(/issuer=/g)).toHaveLength(1);
});

test("a deployment missing BETTER_AUTH_SECRET is refused at push", async () => {
  const bare = await startBackend();
  try {
    await expect(deploy(bare, { BETTER_AUTH_SECRET: undefined })).rejects.toThrow(
      /BETTER_AUTH_SECRET/,
    );
  } finally {
    await bare.stop();
  }
});

test("a verified-email auth user links onto an existing unlinked row", async () => {
  await seedTable(backend, "users", [
    { email: "ada+linked@example.com", name: "Original", createdAt: 1 },
  ]);

  // The component calls this trigger when it creates a user; Google is what reports emailVerified: true.
  await runFunction(backend, internal.auth.onCreate, {
    model: "user",
    doc: {
      _id: "auth_google_1",
      email: "ada+linked@example.com",
      emailVerified: true,
      name: "Ada",
    },
  });

  expect(await usersByEmail("ada+linked@example.com")).toEqual([
    expect.objectContaining({ name: "Original", authUserId: "auth_google_1" }),
  ]);
});

test("sign-up with a known but unverified email gets its own row", async () => {
  await seedTable(backend, "users", [
    { email: "ada+claimed@example.com", name: "Original", createdAt: 1 },
  ]);

  expect((await signUp("ada+claimed@example.com")).status).toBe(200);

  const rows = await usersByEmail("ada+claimed@example.com");
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.name === "Original")?.authUserId).toBeUndefined();
});

test("google sign-in uses the project's client and the base front's callback", async () => {
  const url = await googleRedirectUri();

  expect(url.hostname).toBe("accounts.google.com");
  expect(url.searchParams.get("client_id")).toBe("placeholder-google-client-id");
  expect(url.searchParams.get("redirect_uri")).toBe(`${backend.siteUrl}/api/auth/callback/google`);
});

test("the Google callback follows a trusted front and ignores an untrusted one", async () => {
  // The web proxy sends the front's host in these headers; http.ts restores them for Better Auth.
  const via = (host: string) => ({
    "x-better-auth-forwarded-host": host,
    "x-better-auth-forwarded-proto": "https",
  });
  const hop = "https://hop.example.com/api/auth/callback/google";
  await setEnv(backend, "AUTH_TRUSTED_ORIGINS", "https://trusted.example.com");
  try {
    expect(
      (await googleRedirectUri(via("trusted.example.com"))).searchParams.get("redirect_uri"),
    ).toBe("https://trusted.example.com/api/auth/callback/google");

    await setEnv(backend, "GOOGLE_REDIRECT_URI", hop);
    expect(
      (await googleRedirectUri(via("trusted.example.com"))).searchParams.get("redirect_uri"),
    ).toBe(hop);

    expect(
      (await googleRedirectUri(via("evil.example.com"))).searchParams.get("redirect_uri"),
    ).toBe(`${backend.siteUrl}/api/auth/callback/google`);
  } finally {
    await setEnv(backend, "GOOGLE_REDIRECT_URI", undefined);
    await setEnv(backend, "AUTH_TRUSTED_ORIGINS", undefined);
  }
});

test("AUTH_DISABLE_SIGNUP refuses new registrations but keeps sign-in working", async () => {
  // A backend of its own: closing sign-up on the shared one would break the other tests.
  const gated = await startBackend();
  try {
    await deploy(gated);
    expect((await signUp("ada+existing@example.com", gated)).status).toBe(200);

    await setEnv(gated, "AUTH_DISABLE_SIGNUP", "true");
    expect((await signUp("ada+newcomer@example.com", gated)).status).toBe(400);

    const signIn = await fetch(`${gated.siteUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: gated.siteUrl },
      body: JSON.stringify({ email: "ada+existing@example.com", password: PASSWORD }),
    });
    expect(signIn.status).toBe(200);

    expect(await query(gated, api.auth.signUpDisabled, {})).toBe(true);
  } finally {
    await gated.stop();
  }
});
