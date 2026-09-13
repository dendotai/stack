import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { type DevSite, devServerOptions } from "./dev-server";

// Single source of truth for the dev URL: package.json#devSite. The optional
// `@dendotai/devsite` tool reads the same field to generate its Caddy route, so
// host/port can't drift. If you don't use devsite, the host/allowedHosts/hmr
// options in dev-server.ts are harmless — `vite dev` still serves on the port.
//
// `PORT` replaces all of it: a second checkout (an agent worktree) then serves
// on that port, on localhost only. See dev-server.ts. It comes from the
// process environment or from `.env.local` (see .env.local.example) — the
// latter through `loadEnv`, because Vite does not load env files before it
// evaluates this config, and `bun run dev` does not load them either.
const devSite = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
  .devSite as DevSite;

export default defineConfig(({ mode }) => ({
  server: devServerOptions(loadEnv(mode, import.meta.dirname, "").PORT, devSite),
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    // Generator options live in `tsr.config.json`, so the plugin and the `tsr`
    // CLI behind `bun run generate` read one source. Chief among them:
    // `routeFileIgnorePattern` keeps the tests colocated in route folders
    // (`home.test.tsx` beside `route.tsx`, per ADR 0005) out of the route scan,
    // which otherwise warns once per build for each file exporting no `Route`.
    tanstackStart(),
    viteReact(),
  ],
}));
