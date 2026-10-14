import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authedMutation, authedQuery } from "./authed";
import { themeValidator } from "./schema";

// Adding a setting: the steps are in ADR 0010.
const DEFAULTS = {
  theme: "system",
} as const satisfies Partial<Doc<"userSettings">>;

type Settings = { [K in keyof typeof DEFAULTS]: NonNullable<Doc<"userSettings">[K]> };

async function getRow(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"userSettings"> | null> {
  return await ctx.db
    .query("userSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export const getForCaller = authedQuery({
  args: {},
  handler: async (ctx): Promise<Settings> => {
    const row = ctx.user ? await getRow(ctx, ctx.user._id) : null;
    return { theme: row?.theme ?? DEFAULTS.theme };
  },
});

export const set = authedMutation({
  args: {
    setting: v.union(v.object({ key: v.literal("theme"), value: themeValidator })),
  },
  handler: async (ctx, { setting }): Promise<null> => {
    const row = await getRow(ctx, ctx.user._id);
    if (row) {
      await ctx.db.patch("userSettings", row._id, { [setting.key]: setting.value });
    } else {
      await ctx.db.insert("userSettings", { userId: ctx.user._id, [setting.key]: setting.value });
    }
    return null;
  },
});
