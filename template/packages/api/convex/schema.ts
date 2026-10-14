import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const themeValidator = v.union(v.literal("system"), v.literal("light"), v.literal("dark"));

export default defineSchema({
  // The app's projection of a Better Auth component user (ADR 0004). `authUserId` is optional because linking writes it after the row exists: a row inserted without one links itself by verified email when its owner signs in — see `createFromAuthUser`.
  users: defineTable({
    authUserId: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),

  // One row per user, created by the first change; every setting is optional (ADR 0010).
  userSettings: defineTable({
    userId: v.id("users"),
    theme: v.optional(themeValidator),
  }).index("by_userId", ["userId"]),
});
