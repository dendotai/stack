/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { createFromAuthUser } from "./users";

const modules = import.meta.glob("./**/*.ts");

test("getCurrent throws when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.users.getCurrent, {})).rejects.toThrow(/auth/i);
});

test("the row created from an auth user is what getCurrent returns", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await createFromAuthUser(ctx, {
      _id: "auth_skeleton",
      email: "skel@example.com",
      name: "Skeleton",
      emailVerified: true,
    });
  });

  // The identity's subject is the auth user id, so resolution finds the row
  // by_authUserId — the whole link between the two planes (ADR 0004).
  const user = await t.withIdentity({ subject: "auth_skeleton" }).query(api.users.getCurrent, {});
  expect(user?.email).toBe("skel@example.com");
  expect(user?.name).toBe("Skeleton");
  expect(user?.authUserId).toBe("auth_skeleton");
});

test("getCurrent tolerates a missing user row (returns null)", async () => {
  const t = convexTest(schema, modules);
  // Authenticated, but no app row was ever created — the read path stays graceful.
  const user = await t.withIdentity({ subject: "user_no_row" }).query(api.users.getCurrent, {});
  expect(user).toBeNull();
});

// The linking rule: a sign-in whose email the identity provider has verified
// must map onto the pre-existing app row with that email rather than shadow it
// with a new one.
test("a verified-email auth user links to the existing users row by email", async () => {
  const t = convexTest(schema, modules);
  const existingId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "den@example.com",
      name: "Den",
      createdAt: 1,
    });
  });

  await t.run(async (ctx) => {
    await createFromAuthUser(ctx, {
      _id: "auth_1",
      email: "den@example.com",
      name: "Den",
      emailVerified: true,
    });
  });

  const rows = await t.run(async (ctx) => await ctx.db.query("users").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    _id: existingId,
    authUserId: "auth_1",
    email: "den@example.com",
  });
});

// The guard on the rule: email/password sign-up doesn't verify the address, so
// an unverified match must get its own row — linking it would hand the existing
// account to whoever typed a known email.
test("an unverified-email auth user gets a new row even when the email matches", async () => {
  const t = convexTest(schema, modules);
  const existingId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "den@example.com",
      name: "Den",
      createdAt: 1,
    });
  });

  await t.run(async (ctx) => {
    await createFromAuthUser(ctx, {
      _id: "auth_2",
      email: "den@example.com",
      name: "Impostor",
      emailVerified: false,
    });
  });

  const rows = await t.run(async (ctx) => await ctx.db.query("users").collect());
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row._id === existingId)?.authUserId).toBeUndefined();
});

// A row that already belongs to another auth user is not up for grabs: the
// component enforces unique emails per auth user, but a stale or duplicate app
// row can still share the address. Only an *unlinked* row links.
test("a verified-email auth user never re-links a row that already has an authUserId", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      authUserId: "auth_taken",
      email: "den@example.com",
      name: "Old",
      createdAt: 1,
    });
  });

  await t.run(async (ctx) => {
    await createFromAuthUser(ctx, {
      _id: "auth_new",
      email: "den@example.com",
      name: "Den",
      emailVerified: true,
    });
  });

  const rows = await t.run(async (ctx) => await ctx.db.query("users").collect());
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.authUserId === "auth_taken")?.name).toBe("Old");
  expect(rows.find((row) => row.authUserId === "auth_new")?.name).toBe("Den");
});
