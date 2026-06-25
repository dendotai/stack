// biome-ignore lint/style/noRestrictedImports: public health check — intentionally unauthenticated, no user on ctx.
import { query } from "./_generated/server";

export const ping = query({
  args: {},
  handler: async () => ({ ok: true, at: Date.now() }),
});
