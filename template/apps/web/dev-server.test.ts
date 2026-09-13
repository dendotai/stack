import { describe, expect, test } from "vitest";
import { devServerOptions } from "./dev-server";

describe("devServerOptions", () => {
  test("without PORT, sets nothing: the devsite plugin picks the port", () => {
    expect(devServerOptions(undefined)).toBeUndefined();
  });

  test("an empty PORT counts as unset", () => {
    expect(devServerOptions("")).toBeUndefined();
  });

  test("with PORT, binds exactly that port on localhost", () => {
    expect(devServerOptions("3012")).toEqual({ port: 3012, strictPort: true, host: "localhost" });
  });

  test("rejects a PORT that is not a TCP port number", () => {
    for (const bad of ["abc", "0", "70000", "30.5"]) {
      expect(() => devServerOptions(bad)).toThrow(`PORT must be a TCP port number, got "${bad}"`);
    }
  });
});
