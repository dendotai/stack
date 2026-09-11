/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { googleRedirectURI } from "./auth";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

// The query is the signed-out form's only view of the gate, so it has to read
// the same deployment variable the sign-up endpoint enforces.
test("signUpDisabled is false while AUTH_DISABLE_SIGNUP is unset", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.auth.signUpDisabled, {})).toBe(false);
});

test("signUpDisabled mirrors AUTH_DISABLE_SIGNUP=true", async () => {
  vi.stubEnv("AUTH_DISABLE_SIGNUP", "true");
  const t = convexTest(schema, modules);
  expect(await t.query(api.auth.signUpDisabled, {})).toBe(true);
});

// The chosen value reaches Google as `redirect_uri` and comes back as the host
// the authorization code is delivered to, so these cases are the deployment's
// whole defence against a forged forwarded host.
const stubDevFronts = () => {
  vi.stubEnv("SITE_URL", "https://dev.example.com");
  vi.stubEnv("AUTH_TRUSTED_ORIGINS", "https://stack.internal");
};

test("a request with no front host gets the base URL's callback", () => {
  stubDevFronts();
  expect(googleRedirectURI(undefined)).toBe("https://dev.example.com/api/auth/callback/google");
});

test("the base URL's own front names itself", () => {
  stubDevFronts();
  expect(googleRedirectURI("https://dev.example.com")).toBe(
    "https://dev.example.com/api/auth/callback/google",
  );
});

test("a trusted front takes the redirect override", () => {
  stubDevFronts();
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://internal.example.com/api/auth/callback/google");
  expect(googleRedirectURI("https://stack.internal")).toBe(
    "https://internal.example.com/api/auth/callback/google",
  );
});

test("a trusted front with no override names itself", () => {
  stubDevFronts();
  expect(googleRedirectURI("https://stack.internal")).toBe(
    "https://stack.internal/api/auth/callback/google",
  );
});

test("an untrusted front never chooses the redirect, override or not", () => {
  stubDevFronts();
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://internal.example.com/api/auth/callback/google");
  expect(googleRedirectURI("https://evil.example")).toBe(
    "https://dev.example.com/api/auth/callback/google",
  );
});

test("prod trusts no second front, so every request gets the base URL", () => {
  vi.stubEnv("SITE_URL", "https://example.com");
  expect(googleRedirectURI("https://stack.internal")).toBe(
    "https://example.com/api/auth/callback/google",
  );
});
