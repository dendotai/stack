import type { ServerOptions } from "vite";

export type DevSite = { host: string; port: number };

// `PORT` is the worktree override: an agent checkout beside the main one gets
// its own port and is reached on plain localhost by a headless browser only.
// The devsite front belongs to the main checkout alone, so a `PORT` run leaves
// it out — its HMR client would otherwise connect to a proxy that does not
// route to this port.
export function devServerOptions(portFromEnv: string | undefined, devSite: DevSite): ServerOptions {
  if (portFromEnv === undefined || portFromEnv === "") {
    return {
      port: devSite.port,
      strictPort: true,
      // Listen on all interfaces so a Tailscale-reachable Caddy proxy
      // (https://<host>) can reach the dev server.
      host: true,
      allowedHosts: [devSite.host],
      // Caddy terminates TLS on :443 and proxies to the dev port, so the HMR
      // client must connect back over wss to the proxy host, not the raw port.
      // Browse via https://<host> everywhere (incl. desktop) so HMR works.
      hmr: { host: devSite.host, protocol: "wss", clientPort: 443 },
    };
  }
  const port = Number(portFromEnv);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a TCP port number, got "${portFromEnv}"`);
  }
  return { port, strictPort: true, host: "localhost" };
}
