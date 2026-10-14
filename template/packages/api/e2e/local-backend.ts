import { execFileSync } from "node:child_process";
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
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getFreePort, startServerProcess } from "./server-process";

// The binary runs directly rather than through the Convex CLI's local deployment, so every run gets a fresh database and a backend that outlives the deploy — see ADR 0009.

const e2eDir = dirname(fileURLToPath(import.meta.url));
const backendVersion = readFileSync(join(e2eDir, "CONVEX_LOCAL_BACKEND_VERSION"), "utf8").trim();
const cacheDir = join(e2eDir, ".cache", backendVersion);
const binaryPath = join(cacheDir, "convex-local-backend");
const instanceName = "e2e";

const releaseAssets: Partial<Record<`${NodeJS.Platform}-${NodeJS.Architecture}`, string>> = {
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
  const url = `https://github.com/get-convex/convex-backend/releases/download/${backendVersion}/${asset}`;
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

export type LocalBackend = {
  /** The client API: queries, mutations, deploys. */
  url: string;
  /** The HTTP router, where Better Auth's `/api/auth/*` routes answer. */
  siteUrl: string;
  adminKey: string;
  stop: () => Promise<void>;
};

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

  const { stop } = await startServerProcess({
    name: "convex-local-backend",
    command: binary,
    args: [
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
    cwd: workDir,
    workDir,
    isReady: async () => (await fetch(`${url}/version`)).ok,
    timeoutMs: 20_000,
  });

  return { url, siteUrl, adminKey, stop };
}
