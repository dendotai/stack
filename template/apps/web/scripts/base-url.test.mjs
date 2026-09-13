import { describe, expect, test } from "vitest";
import { baseUrl } from "./base-url.mjs";

describe("baseUrl", () => {
  test("defaults to the devsite origin", () => {
    expect(baseUrl({})).toBe("https://stack.internal");
  });

  test("with PORT, targets the worktree app on localhost", () => {
    expect(baseUrl({ PORT: "3012" })).toBe("http://localhost:3012");
  });

  test("STACK_BASE_URL wins over PORT", () => {
    expect(baseUrl({ PORT: "3012", STACK_BASE_URL: "https://localhost:3000" })).toBe(
      "https://localhost:3000",
    );
  });
});
