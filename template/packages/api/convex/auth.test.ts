/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
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
