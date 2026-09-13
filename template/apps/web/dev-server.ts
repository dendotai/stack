import type { ServerOptions } from "vite";

// `PORT` is the worktree override: an agent checkout beside the main one gets
// its own port and is reached on plain localhost by a headless browser only.
// Without it the devsite plugin binds a free port and registers the host's
// route; that route belongs to the main checkout alone, and the plugin has no
// off switch of its own, so a `PORT` run must leave it out of the plugin list.
export function devServerOptions(portFromEnv: string | undefined): ServerOptions | undefined {
  if (portFromEnv === undefined || portFromEnv === "") return undefined;
  const port = Number(portFromEnv);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a TCP port number, got "${portFromEnv}"`);
  }
  return { port, strictPort: true, host: "localhost" };
}
