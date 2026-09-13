import { cloudflare } from "@cloudflare/vite-plugin";
import { devsite } from "@den-ai/devsite/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { devServerOptions } from "./dev-server";

// No fixed port. The devsite plugin binds a free port and registers
// https://<package.json#devSite.host> with the local Caddy, so any number of
// projects run at once. `PORT` is the one exception, set by an agent worktree:
// then Vite binds that port on localhost and devsite stays off (see
// dev-server.ts). It comes from the process environment or from `.env.local`
// (see .env.local.example) — the latter through `loadEnv`, because Vite does
// not load env files before it evaluates this config, and `bun run dev` does
// not load them either; the process environment wins over the file.
export default defineConfig(({ mode }) => {
  const server = devServerOptions(loadEnv(mode, import.meta.dirname, "").PORT);
  return {
    server,
    resolve: { tsconfigPaths: true },
    plugins: [
      ...(server === undefined ? [devsite()] : []),
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
  };
});
