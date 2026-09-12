import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Single source of truth for the dev URL: package.json#devSite. The optional
// `@dendotai/devsite` tool reads the same field to generate its Caddy route, so
// host/port can't drift. If you don't use devsite, the host/allowedHosts/hmr
// block below is harmless — `vite dev` still serves on the given port.
const { host, port } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
  .devSite as { host: string; port: number };

export default defineConfig({
  server: {
    port,
    strictPort: true,
    // Listen on all interfaces so a Tailscale-reachable Caddy proxy
    // (https://<host>) can reach the dev server.
    host: true,
    allowedHosts: [host],
    // Caddy terminates TLS on :443 and proxies to the dev port, so the HMR
    // client must connect back over wss to the proxy host, not the raw port.
    // Browse via https://<host> everywhere (incl. desktop) so HMR works.
    hmr: {
      host,
      protocol: "wss",
      clientPort: 443,
    },
  },
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
});
