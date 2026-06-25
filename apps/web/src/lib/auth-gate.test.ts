import { describe, expect, test } from "vitest";
import { isPublicPath } from "./auth-gate";

describe("isPublicPath", () => {
  test("treats `/` as public", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  test("treats `/login` as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  test("treats any path under `/api/auth/` as public", () => {
    expect(isPublicPath("/api/auth/callback")).toBe(true);
    expect(isPublicPath("/api/auth/anything")).toBe(true);
  });

  test("treats arbitrary app routes as non-public", () => {
    expect(isPublicPath("/backlog")).toBe(false);
    expect(isPublicPath("/library")).toBe(false);
    expect(isPublicPath("/logout")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
  });

  test("does not treat unrelated `/api/*` paths as public", () => {
    expect(isPublicPath("/api/anything")).toBe(false);
  });

  test("does not match a path that merely contains `/login`", () => {
    expect(isPublicPath("/loginxyz")).toBe(false);
    expect(isPublicPath("/foo/login")).toBe(false);
  });
});
