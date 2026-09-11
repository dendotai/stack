import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
// biome-ignore lint/style/noRestrictedImports: this module *defines* the authed wrappers, so it must build on the raw query/mutation.
import { mutation, query } from "./_generated/server";

// Resolve the identity → users row once, on ctx, so handlers don't each repeat
// getUserIdentity() → index lookup. Two flavors preserve a deliberate
// query/mutation asymmetry:
//
//   authedQuery   — throws "Not authenticated" when there's no identity, then
//                   exposes `user: Doc<"users"> | null`. Reads tolerate a
//                   missing row (return null) so a session whose app row
//                   hasn't landed yet still loads.
//   authedMutation — additionally throws "User not found" when the row is
//                   missing, guaranteeing `user` is non-null in the handler.

// The identity's subject is the Better Auth user id (ADR 0004) — the same value
// `createFromAuthUser` writes to `authUserId`.
async function resolveUser(
  ctx: QueryCtx,
  identity: { subject: string },
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique();
}

export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await resolveUser(ctx, identity);
    return { identity, user };
  }),
);

export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await resolveUser(ctx, identity);
    if (!user) throw new Error("User not found");
    return { identity, user };
  }),
);
