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
  // TanStack Start ≥1.134.7 has a regression that bundles server-only modules
  // into the client (TanStack/router#5738, workos/authkit-tanstack-start#18).
  // Forcing the WorkOS packages through Vite's dep optimizer makes esbuild
  // bundle their CJS transitive deps (eventemitter3) with proper ESM interop,
  // sidestepping the broken default-export resolution in raw browser ESM.
  // Remove once the upstream regression is fixed.
  optimizeDeps: {
    include: [
      "@workos/authkit-tanstack-react-start",
      "@workos/authkit-tanstack-react-start/client",
    ],
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
