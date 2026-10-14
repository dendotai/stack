/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function withUser(t: ReturnType<typeof convexTest>, authUserId: string, email: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", { authUserId, email, createdAt: 1 });
  });
  return t.withIdentity({ subject: authUserId });
}

test("getForCaller and set throw when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.settings.getForCaller, {})).rejects.toThrow(/auth/i);
  await expect(
    t.mutation(api.settings.set, { setting: { key: "theme", value: "dark" } }),
  ).rejects.toThrow(/auth/i);
});

test("a user who never changed a setting gets the defaults", async () => {
  const t = convexTest(schema, modules);
  const ada = await withUser(t, "auth_ada", "ada@example.com");
  expect(await ada.query(api.settings.getForCaller, {})).toEqual({ theme: "system" });
});

test("the first set creates the row and getForCaller returns the value", async () => {
  const t = convexTest(schema, modules);
  const ada = await withUser(t, "auth_ada", "ada@example.com");
  await ada.mutation(api.settings.set, { setting: { key: "theme", value: "dark" } });
  expect(await ada.query(api.settings.getForCaller, {})).toEqual({ theme: "dark" });
});

test("a later set changes the same row", async () => {
  const t = convexTest(schema, modules);
  const ada = await withUser(t, "auth_ada", "ada@example.com");
  await ada.mutation(api.settings.set, { setting: { key: "theme", value: "dark" } });
  await ada.mutation(api.settings.set, { setting: { key: "theme", value: "light" } });
  expect(await ada.query(api.settings.getForCaller, {})).toEqual({ theme: "light" });
  const rows = await t.run(async (ctx) => await ctx.db.query("userSettings").collect());
  expect(rows).toHaveLength(1);
});

test("one user's settings never reach another user", async () => {
  const t = convexTest(schema, modules);
  const ada = await withUser(t, "auth_ada", "ada@example.com");
  const bob = await withUser(t, "auth_bob", "bob@example.com");
  await ada.mutation(api.settings.set, { setting: { key: "theme", value: "dark" } });
  expect(await bob.query(api.settings.getForCaller, {})).toEqual({ theme: "system" });
});

test("set rejects a value of the wrong type for its key", async () => {
  const t = convexTest(schema, modules);
  const ada = await withUser(t, "auth_ada", "ada@example.com");
  await expect(
    // @ts-expect-error -- the union ties each key to its value type; the runtime validator must reject it too.
    ada.mutation(api.settings.set, { setting: { key: "theme", value: "blue" } }),
  ).rejects.toThrow(/validator/i);
});
