import { describe, expect, test } from "vitest";
import { isPublicPath, safeReturnPath } from "./auth-gate";

describe("isPublicPath", () => {
  test("treats `/` as public", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  test("treats `/login` as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  test("treats any path under `/api/auth/` as public", () => {
    expect(isPublicPath("/api/auth/sign-in/email")).toBe(true);
    expect(isPublicPath("/api/auth/anything")).toBe(true);
  });

  test("treats arbitrary app routes as non-public", () => {
    expect(isPublicPath("/backlog")).toBe(false);
    expect(isPublicPath("/library")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
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

describe("safeReturnPath", () => {
  test("keeps a path within this app", () => {
    expect(safeReturnPath("/home")).toBe("/home");
    expect(safeReturnPath("/library?page=2")).toBe("/library?page=2");
  });

  test("falls back to `/home` when there is no path", () => {
    expect(safeReturnPath(undefined)).toBe("/home");
    expect(safeReturnPath("")).toBe("/home");
  });

  test("refuses anything a browser would read as another origin", () => {
    expect(safeReturnPath("https://evil.example/")).toBe("/home");
    expect(safeReturnPath("//evil.example/")).toBe("/home");
    expect(safeReturnPath("/\\evil.example/")).toBe("/home");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/home");
  });
});
