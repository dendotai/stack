import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
// biome-ignore lint/style/noRestrictedImports: this module *defines* the authed wrappers, so it must build on the raw query/mutation.
import { mutation, query } from "./_generated/server";

// Resolve the WorkOS identity → users row once, on ctx, so handlers don't each
// repeat getUserIdentity() → by_workosId lookup. Two flavors preserve a
// deliberate query/mutation asymmetry:
//
//   authedQuery   — throws "Not authenticated" when there's no identity, then
//                   exposes `user: Doc<"users"> | null`. Reads tolerate a
//                   missing row (return null) so a session whose getOrCreate
//                   hasn't landed yet still loads.
//   authedMutation — additionally throws "User not found" when the row is
//                   missing, guaranteeing `user` is non-null in the handler.

export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_workosId", (q) => q.eq("workosId", identity.subject))
      .unique();
    return { identity, user };
  }),
);

export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_workosId", (q) => q.eq("workosId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    return { identity, user };
  }),
);
