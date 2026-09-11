/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("getCurrent throws when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.users.getCurrent, {})).rejects.toThrow(/auth/i);
});

test("getOrCreate inserts a user row, then getCurrent returns it", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "user_skeleton" });

  await asUser.mutation(api.users.getOrCreate, { email: "skel@example.com", name: "Skeleton" });

  const user = await asUser.query(api.users.getCurrent, {});
  expect(user?.email).toBe("skel@example.com");
  expect(user?.name).toBe("Skeleton");
  expect(user?.workosId).toBe("user_skeleton");
});

test("getOrCreate is idempotent for the same identity", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "user_idempotent" });

  const first = await asUser.mutation(api.users.getOrCreate, { email: "a@example.com" });
  const second = await asUser.mutation(api.users.getOrCreate, { email: "a@example.com" });
  expect(first).toBe(second);
});

test("getCurrent tolerates a missing user row (returns null)", async () => {
  const t = convexTest(schema, modules);
  // Authenticated, but getOrCreate never ran — the read path stays graceful.
  const user = await t.withIdentity({ subject: "user_no_row" }).query(api.users.getCurrent, {});
  expect(user).toBeNull();
});
