import { cloudflare } from "@cloudflare/vite-plugin";
import { devsite } from "@den-ai/devsite/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// No fixed port. The devsite plugin binds a free port and registers
// https://<package.json#devSite.host> with the local Caddy, so any number of
// projects run at once. `PORT` is the one exception, set by an agent worktree:
// then Vite binds that port on localhost and devsite stays off, because a
// second checkout running the plugin would register the same host and take
// the route away from the main checkout. The plugin has no off switch of its
// own, so the skip lives here.
const port = process.env.PORT === undefined ? undefined : Number(process.env.PORT);
if (port !== undefined && !Number.isInteger(port)) {
  throw new Error(`PORT must be an integer, got "${process.env.PORT}"`);
}

export default defineConfig({
  server: port === undefined ? undefined : { port, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [
    ...(port === undefined ? [devsite()] : []),
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
});
