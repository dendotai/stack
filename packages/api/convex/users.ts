import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
// biome-ignore lint/style/noRestrictedImports: getOrCreate bootstraps the user row, so it must run before one exists — authedMutation would throw "User not found" here.
import { mutation } from "./_generated/server";
import { authedQuery } from "./authed";

export const getOrCreate = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, name }): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_workosId", (q) => q.eq("workosId", identity.subject))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      workosId: identity.subject,
      email,
      name,
      createdAt: Date.now(),
    });
  },
});

// The authed read path the skeleton's /home route demonstrates end-to-end:
// authedQuery resolves the WorkOS identity → users row onto ctx, and the handler
// just returns it. Tolerates a null user (see authed.ts) so a session whose
// getOrCreate hasn't landed yet still loads.
export const getCurrent = authedQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"users"> | null> => ctx.user,
});
