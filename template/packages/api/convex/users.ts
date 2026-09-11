import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authedQuery } from "./authed";

// The Better Auth component owns identity; this row is the app's projection of
// it, and `authUserId` is the only link between the two. Runs from the
// component's `user.onCreate` trigger (wired in auth.ts) inside the same
// transaction as the component's own insert, so an app row can never be missing
// for an auth user that exists.
//
// Linking is gated on `emailVerified` — the identity provider's claim, since no
// verification flow of our own exists. An unverified match must NOT link:
// email/password sign-up doesn't verify the address, so linking there would let
// anyone who signs up with a known email claim that account.
export async function createFromAuthUser(
  ctx: MutationCtx,
  authUser: { _id: string; email: string; name: string; emailVerified: boolean },
): Promise<void> {
  if (authUser.emailVerified) {
    // Duplicate emails across rows can exist (an unlinked row plus a stale
    // sign-up, say), so no `.unique()`: the first still-unlinked row wins, and
    // a row already claimed by another auth user is never re-linked.
    const candidates = ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", authUser.email));
    for await (const row of candidates) {
      if (row.authUserId === undefined) {
        await ctx.db.patch(row._id, { authUserId: authUser._id });
        return;
      }
    }
  }
  await ctx.db.insert("users", {
    authUserId: authUser._id,
    email: authUser.email,
    name: authUser.name,
    createdAt: Date.now(),
  });
}

// The authed read path the skeleton's /home route demonstrates end-to-end:
// authedQuery resolves the identity → users row onto ctx, and the handler just
// returns it. Tolerates a null user (see authed.ts) so a session whose app row
// hasn't landed yet still loads.
export const getCurrent = authedQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"users"> | null> => ctx.user,
});
