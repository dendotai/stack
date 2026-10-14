import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { LocalBackend } from "./local-backend";

const execFileAsync = promisify(execFile);
const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function convexCli(backend: LocalBackend, args: string[]): Promise<string> {
  const target = ["--url", backend.url, "--admin-key", backend.adminKey];
  const { stdout } = await execFileAsync("bunx", ["convex", ...args, ...target], { cwd: apiRoot });
  return stdout;
}

/** The env vars `deploy` sets on a deployment. `undefined` leaves one unset. */
export type DeploymentEnv = {
  BETTER_AUTH_SECRET?: string;
  SITE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  AUTH_DISABLE_SIGNUP?: string;
  AUTH_TRUSTED_ORIGINS?: string;
};

/**
 * Pushes this package's real `convex/` functions to a running local backend.
 *
 * The pushed code reads the deployment's own env vars, never the shell's. `SITE_URL` defaults to the backend's own HTTP router, which the backend tests call directly; a test that goes through the web Worker passes the Worker's origin instead.
 */
export async function deploy(backend: LocalBackend, env: DeploymentEnv = {}): Promise<void> {
  const vars: DeploymentEnv = {
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
    SITE_URL: backend.siteUrl,
    // Building Google's authorization URL, all a test reaches, needs no real client.
    GOOGLE_CLIENT_ID: "placeholder-google-client-id",
    GOOGLE_CLIENT_SECRET: "placeholder-google-client-secret",
    ...env,
  };
  for (const [name, value] of Object.entries(vars)) {
    if (value !== undefined) await convexCli(backend, ["env", "set", name, value]);
  }
  await convexCli(backend, ["deploy", "-y"]);
}

/** Sets or, with `undefined`, removes an env var. The next function call reads it; no redeploy. */
export async function setEnv(
  backend: LocalBackend,
  name: keyof DeploymentEnv,
  value: string | undefined,
): Promise<void> {
  if (value === undefined) await convexCli(backend, ["env", "remove", name]);
  else await convexCli(backend, ["env", "set", name, value]);
}

// A function that ran and threw answers {status: "error"}; a request refused before any function ran (an unknown token issuer, say) answers {code, message}.
type ConvexHttpResult =
  | { status: "success"; value: unknown }
  | { status: "error"; errorMessage: string }
  | { code: string; message: string };

/**
 * Calls a deployed public query over HTTP.
 *
 * @param asToken - a JWT the deployment resolves through its own auth providers, as a signed-in client's call would be; without it the call runs as admin.
 */
export async function query(
  backend: LocalBackend,
  path: string,
  args: Record<string, unknown> = {},
  { asToken }: { asToken?: string } = {},
): Promise<unknown> {
  const res = await fetch(`${backend.url}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: asToken ? `Bearer ${asToken}` : `Convex ${backend.adminKey}`,
    },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const body = (await res.json()) as ConvexHttpResult;
  if (!("status" in body) || body.status !== "success") {
    const reason = "errorMessage" in body ? body.errorMessage : body.message;
    throw new Error(`query ${path} failed: ${reason}`);
  }
  return body.value;
}

/** Runs any deployed function by name through the CLI, internal ones included, which the admin key allows. */
export async function runFunction(
  backend: LocalBackend,
  name: string,
  args: Record<string, unknown> = {},
): Promise<void> {
  await convexCli(backend, ["run", name, JSON.stringify(args)]);
}

/** Inserts rows straight into a table, past every deployed function, for state the app no longer creates (a `users` row with no `authUserId`). */
export async function seedTable(
  backend: LocalBackend,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const file = join(tmpdir(), `seed-${table}-${randomBytes(6).toString("hex")}.jsonl`);
  await writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n"));
  try {
    // `--append` keeps the rows earlier tests wrote.
    await convexCli(backend, ["import", "--table", table, "--append", "--format", "jsonLines", "-y", file]);
  } finally {
    await rm(file, { force: true });
  }
}

/** Evaluates a read-only query against the deployment's tables, for data no deployed function returns. */
export async function inlineQuery<T>(backend: LocalBackend, js: string): Promise<T> {
  return JSON.parse(await convexCli(backend, ["run", "--inline-query", js])) as T;
}
