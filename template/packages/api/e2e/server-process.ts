import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("failed to allocate a free port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export type ServerProcess = { stop: () => Promise<void> };

/**
 * Spawns a server and resolves once `isReady` answers true. A failed start stops the process, and the error carries everything it printed.
 *
 * @param opts.workDir - a temporary folder the server owns; `stop` deletes it.
 */
export async function startServerProcess(opts: {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  workDir: string;
  isReady: () => Promise<boolean>;
  timeoutMs: number;
}): Promise<ServerProcess> {
  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output: string[] = [];
  // A failure inside the server reaches a test only as an error response, so the server's own log line naming the cause must stream to the CI log as it happens.
  const tap = (chunk: Buffer) => {
    output.push(chunk.toString());
    process.stderr.write(chunk);
  };
  child.stdout?.on("data", tap);
  child.stderr?.on("data", tap);

  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
    rmSync(opts.workDir, { recursive: true, force: true });
  };

  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      await stop();
      throw new Error(`${opts.name} exited with code ${child.exitCode}:\n${output.join("")}`);
    }
    if (await opts.isReady().catch(() => false)) return { stop };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  await stop();
  throw new Error(`${opts.name} did not start within ${opts.timeoutMs}ms:\n${output.join("")}`);
}
