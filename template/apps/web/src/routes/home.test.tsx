import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

// The home route reads the current user through @convex-dev/react-query +
// TanStack Query. Mock both layers so the component renders without a live
// Convex client — we're testing the view, not the data plumbing.
const state = vi.hoisted(() => ({
  user: undefined as undefined | { name?: string; email?: string } | null,
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: (fn: unknown, args: unknown) => ({ queryKey: ["convexQuery", fn, args ?? {}] }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.user, isPending: state.user === undefined }),
}));

import { Home } from "./_app.home";

afterEach(cleanup);

test("shows a loading line while the query is pending", () => {
  state.user = undefined;
  render(<Home />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("greets the user by name", () => {
  state.user = { name: "Ada", email: "ada@example.com" };
  render(<Home />);
  expect(screen.getByText(/hello, ada/i)).toBeInTheDocument();
});

test("falls back to email, then to a generic greeting", () => {
  state.user = { email: "ada@example.com" };
  render(<Home />);
  expect(screen.getByText(/hello, ada@example\.com/i)).toBeInTheDocument();

  cleanup();
  state.user = null;
  render(<Home />);
  expect(screen.getByText(/hello, there/i)).toBeInTheDocument();
});
