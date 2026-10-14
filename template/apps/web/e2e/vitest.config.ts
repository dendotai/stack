import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.e2e.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    // Every suite builds the Worker into the same dist/, so files run one at a time.
    fileParallelism: false,
  },
});
