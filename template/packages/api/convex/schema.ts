import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // The app's projection of a Better Auth component user (ADR 0004).
  // `authUserId` is optional because linking writes it after the row exists: a
  // row inserted without one links itself by verified email when its owner
  // signs in — see `createFromAuthUser`.
  users: defineTable({
    authUserId: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),
});
