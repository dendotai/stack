import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "*.test.ts", "scripts/*.test.mjs"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
