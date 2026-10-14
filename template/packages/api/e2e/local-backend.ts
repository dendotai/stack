import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The binary runs directly rather than through the Convex CLI's local deployment, so every run gets a fresh database and a backend that outlives the deploy — see ADR 0009.

const e2eDir = dirname(fileURLToPath(import.meta.url));
const releaseTag = readFileSync(join(e2eDir, "CONVEX_LOCAL_BACKEND_VERSION"), "utf8").trim();
const cacheDir = join(e2eDir, ".cache", releaseTag);
const binaryPath = join(cacheDir, "convex-local-backend");
const instanceName = "e2e";

const releaseAssets: Record<string, string> = {
  "darwin-arm64": "convex-local-backend-aarch64-apple-darwin.zip",
  "darwin-x64": "convex-local-backend-x86_64-apple-darwin.zip",
  "linux-arm64": "convex-local-backend-aarch64-unknown-linux-gnu.zip",
  "linux-x64": "convex-local-backend-x86_64-unknown-linux-gnu.zip",
};

async function ensureBinary(): Promise<string> {
  if (existsSync(binaryPath)) return binaryPath;

  const asset = releaseAssets[`${process.platform}-${process.arch}`];
  if (!asset) {
    throw new Error(`convex-local-backend: no release for ${process.platform}/${process.arch}`);
  }
  const url = `https://github.com/get-convex/convex-backend/releases/download/${releaseTag}/${asset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`convex-local-backend download failed: ${res.status} ${url}`);

  // Test files run in parallel and each may download at once, so each unpacks in its own folder and the rename puts a whole binary in place; a reader never sees a half-written file.
  mkdirSync(cacheDir, { recursive: true });
  const unpackDir = mkdtempSync(join(cacheDir, "download-"));
  try {
    const zipPath = join(unpackDir, asset);
    await writeFile(zipPath, Buffer.from(await res.arrayBuffer()));
    execFileSync("unzip", ["-o", zipPath, "-d", unpackDir], { stdio: "ignore" });
    const unpacked = join(unpackDir, "convex-local-backend");
    chmodSync(unpacked, 0o755);
    renameSync(unpacked, binaryPath);
  } finally {
    rmSync(unpackDir, { recursive: true, force: true });
  }
  return binaryPath;
}

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

export type LocalBackend = {
  /** The client API: queries, mutations, deploys. */
  url: string;
  /** The HTTP router, where Better Auth's `/api/auth/*` routes answer. */
  siteUrl: string;
  adminKey: string;
  stop: () => Promise<void>;
};

async function waitUntilReady(
  url: string,
  child: ChildProcess,
  output: string[],
  hasExited: () => boolean,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (hasExited()) {
      throw new Error(`convex-local-backend exited before starting up:\n${output.join("")}`);
    }
    try {
      const res = await fetch(`${url}/version`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error(`convex-local-backend did not start within ${timeoutMs}ms:\n${output.join("")}`);
}

/** Starts a fresh convex-local-backend on free ports, with its own temporary database. */
export async function startBackend(): Promise<LocalBackend> {
  const binary = await ensureBinary();
  const instanceSecret = randomBytes(32).toString("hex");
  const adminKey = execFileSync(binary, [
    "keygen",
    "admin-key",
    "--instance-name",
    instanceName,
    "--instance-secret",
    instanceSecret,
  ])
    .toString()
    .trim();

  const port = await getFreePort();
  const siteProxyPort = await getFreePort();
  const workDir = mkdtempSync(join(tmpdir(), "convex-e2e-"));
  const url = `http://127.0.0.1:${port}`;
  const siteUrl = `http://127.0.0.1:${siteProxyPort}`;

  const child = spawn(
    binary,
    [
      "--instance-name",
      instanceName,
      "--instance-secret",
      instanceSecret,
      "--port",
      String(port),
      "--site-proxy-port",
      String(siteProxyPort),
      "--local-storage",
      join(workDir, "storage"),
      "--disable-beacon",
      join(workDir, "backend.sqlite3"),
    ],
    { cwd: workDir, stdio: ["ignore", "pipe", "pipe"] },
  );

  const output: string[] = [];
  child.stdout?.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk) => output.push(chunk.toString()));

  let exited = false;
  child.on("exit", () => {
    exited = true;
  });

  await waitUntilReady(url, child, output, () => exited);

  const stop = async () => {
    if (!exited) {
      child.kill();
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
    rmSync(workDir, { recursive: true, force: true });
  };

  return { url, siteUrl, adminKey, stop };
}
