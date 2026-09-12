import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The login page reads the sign-up flag through @convex-dev/react-query +
// TanStack Query, and signs in through the Better Auth client. Mock all three
// so the page renders without a live Convex client or deployment.
const state = vi.hoisted(() => ({
  signUpDisabled: undefined as undefined | boolean,
  signIn: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: (fn: unknown, args: unknown) => ({ queryKey: ["convexQuery", fn, args ?? {}] }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.signUpDisabled }),
}));

vi.mock("../../lib/auth-client", () => ({
  authClient: {
    signIn: { email: state.signIn, social: state.signInSocial },
    signUp: { email: vi.fn() },
  },
}));

import { LoginPage } from "./-components/login-page";

beforeEach(() => {
  state.signUpDisabled = false;
  state.signIn.mockReset();
  state.signInSocial.mockReset();
  state.signInSocial.mockResolvedValue({});
});
afterEach(cleanup);

// #28: between first paint and hydration a submit runs the browser's own
// submission. These two properties of the *server-rendered* markup are what
// keep a password out of the URL in that window.
test("server-renders a POST form whose submit is disabled", () => {
  const dom = new DOMParser().parseFromString(
    renderToString(<LoginPage returnPath="/home" />),
    "text/html",
  );
  expect(dom.querySelector("form")?.getAttribute("method")).toBe("post");
  expect(dom.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(true);
});

test("renders the rejection message in an alert", async () => {
  state.signIn.mockResolvedValue({ error: { message: "Invalid email or password" } });
  const user = userEvent.setup();

  render(<LoginPage returnPath="/home" />);
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "wrong-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
});

test("shows the sign-up control only once the flag says sign-up is open", () => {
  state.signUpDisabled = undefined;
  render(<LoginPage returnPath="/home" />);
  expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument();

  cleanup();
  state.signUpDisabled = true;
  render(<LoginPage returnPath="/home" />);
  expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument();

  cleanup();
  state.signUpDisabled = false;
  render(<LoginPage returnPath="/home" />);
  expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
});

test("the Google button starts the social sign-in with the return path", async () => {
  const user = userEvent.setup();
  render(<LoginPage returnPath="/home/settings" />);

  await user.click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(state.signInSocial).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/home/settings",
  });
});

test("the sign-up control switches the form to creating an account", async () => {
  const user = userEvent.setup();
  render(<LoginPage returnPath="/home" />);

  await user.click(screen.getByRole("button", { name: "Sign up" }));

  expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toBeInTheDocument();
});
