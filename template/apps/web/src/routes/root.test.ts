import { expect, test, vi } from "vitest";

vi.mock("../lib/auth-session", () => ({ getSessionToken: async () => null }));
vi.mock("../lib/auth-bridge", () => ({ ConvexAuthProvider: () => null }));
vi.mock("../lib/auth-client", () => ({ authClient: {} }));

import { Route } from "./__root";

// The router types `loader` as a function or a `{ handler }` object; the root route uses the function form, and the test passes only the context fields that loader reads.
const loader = Route.options.loader as unknown as (args: {
  context: { queryClient: { ensureQueryData: () => Promise<unknown> }; sessionToken: string };
}) => Promise<void>;

test("a failed theme fetch leaves the page loading", async () => {
  const ensureQueryData = vi.fn(async () => {
    throw new Error("Not authenticated");
  });
  await expect(
    loader({ context: { queryClient: { ensureQueryData }, sessionToken: "token" } }),
  ).resolves.toBeUndefined();
  expect(ensureQueryData).toHaveBeenCalledOnce();
});
