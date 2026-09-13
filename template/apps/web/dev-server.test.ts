import { describe, expect, test } from "vitest";
import { devServerOptions } from "./dev-server";

const devSite = { host: "stack.internal", port: 3000 };

describe("devServerOptions", () => {
  test("without PORT, serves the devsite front: its port, host and wss HMR", () => {
    expect(devServerOptions(undefined, devSite)).toEqual({
      port: 3000,
      strictPort: true,
      host: true,
      allowedHosts: ["stack.internal"],
      hmr: { host: "stack.internal", protocol: "wss", clientPort: 443 },
    });
  });

  test("an empty PORT counts as unset", () => {
    expect(devServerOptions("", devSite)).toEqual(devServerOptions(undefined, devSite));
  });

  test("with PORT, binds that port on localhost and registers no devsite front", () => {
    expect(devServerOptions("3012", devSite)).toEqual({
      port: 3012,
      strictPort: true,
      host: "localhost",
    });
  });

  test("rejects a PORT that is not a TCP port number", () => {
    for (const bad of ["abc", "0", "70000", "30.5"]) {
      expect(() => devServerOptions(bad, devSite)).toThrow(
        `PORT must be a TCP port number, got "${bad}"`,
      );
    }
  });
});
