import { execFile, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getFreePort, type LocalBackend } from "@stack/api/e2e/local-backend";

const execFileAsync = promisify(execFile);
const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Builds the Worker as a deploy does. `VITE_CONVEX_URL` is inlined at build time, so the bundle talks to the backend whose origin is passed here.
 */
export async function buildWorker(convexUrl: string): Promise<void> {
  await execFileAsync("bun", ["run", "build"], {
    cwd: webRoot,
    env: { ...process.env, VITE_CONVEX_URL: convexUrl },
  });
}

export type Worker = { origin: string; stop: () => Promise<void> };

/** Starts the built Worker under `wrangler dev`, workerd with local storage, on a free port. */
export async function startWorker(): Promise<Worker> {
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const workDir = mkdtempSync(join(tmpdir(), "worker-e2e-"));
  // Passing --env-file makes wrangler skip the developer's .dev.vars, so a run is the same on every machine.
  const envFile = join(workDir, "e2e.env");
  writeFileSync(envFile, "");

  const child = spawn(
    "bunx",
    ["wrangler", "dev", "--port", String(port), "--persist-to", join(workDir, "state"), "--env-file", envFile],
    { cwd: webRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  const output: string[] = [];
  // An exception inside the Worker reaches a test only as a 5xx, so its console.error must stream to the CI log as it happens.
  const tap = (chunk: Buffer) => {
    output.push(chunk.toString());
    process.stderr.write(chunk);
  };
  child.stdout?.on("data", tap);
  child.stderr?.on("data", tap);

  const stop = async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
    rmSync(workDir, { recursive: true, force: true });
  };

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      await stop();
      throw new Error(`wrangler dev exited with code ${child.exitCode}:\n${output.join("")}`);
    }
    try {
      await fetch(`${origin}/`, { redirect: "manual" });
      return { origin, stop };
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await stop();
  throw new Error(`wrangler dev did not start within 60s:\n${output.join("")}`);
}

/**
 * Serves the backend's two ports on one origin. The Worker knows one Convex URL and derives the auth target from it, but the local backend answers its API on one port and `/api/auth/*` on another; the two path spaces never overlap, so this proxy routes on the prefix.
 */
export async function mergeBackendSurfaces(
  backend: LocalBackend,
): Promise<{ origin: string; close: () => Promise<void> }> {
  // The body is buffered again and fetch decompresses it, so these headers describe a wire format this proxy no longer sends.
  const staleFraming = new Set(["host", "connection", "content-length", "transfer-encoding"]);
  const server: Server = createServer(async (req, res) => {
    const target = req.url?.startsWith("/api/auth") ? backend.siteUrl : backend.url;
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks);
      const headers = Object.fromEntries(
        Object.entries(req.headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string" && !staleFraming.has(entry[0]),
        ),
      );
      const upstream = await fetch(`${target}${req.url}`, {
        method: req.method,
        headers,
        body: body.length > 0 ? body : undefined,
        redirect: "manual",
      });
      const responseHeaders: Record<string, string | string[]> = Object.fromEntries(
        [...upstream.headers.entries()].filter(([name]) => !staleFraming.has(name) && name !== "content-encoding"),
      );
      // Several set-cookie headers must stay separate, never folded into one.
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length > 0) responseHeaders["set-cookie"] = cookies;
      res.writeHead(upstream.status, responseHeaders);
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      res.writeHead(502);
      res.end(String(error));
    }
  });
  // Node closes an idle keep-alive socket after 5s, and workerd can reuse that socket in the same instant, which resets the request: a flake seen only on slow CI runners. Both timeouts outlive any test, and headersTimeout must stay above keepAliveTimeout.
  server.keepAliveTimeout = 600_000;
  server.headersTimeout = 605_000;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("proxy has no port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
