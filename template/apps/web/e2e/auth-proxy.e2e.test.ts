import { deploy, query } from "@stack/api/e2e/deployment";
import { type LocalBackend, startBackend } from "@stack/api/e2e/local-backend";
import { afterAll, beforeAll, expect, test } from "vitest";
import { buildWorker, mergeBackendSurfaces, startWorker, type Worker } from "./worker";

let backend: LocalBackend;
let surfaces: Awaited<ReturnType<typeof mergeBackendSurfaces>>;
let worker: Worker;

beforeAll(async () => {
  backend = await startBackend();
  surfaces = await mergeBackendSurfaces(backend);
  await buildWorker(surfaces.origin);
  worker = await startWorker();
  // Better Auth issues its cookies for SITE_URL, so the deployment names the Worker's origin, as a real one names the app's domain.
  await deploy(backend, { SITE_URL: worker.origin });
}, 300_000);

afterAll(async () => {
  await worker?.stop();
  await surfaces?.close();
  await backend?.stop();
});

const PASSWORD = "correct-horse-battery-staple";

/** A request to the Worker's own origin, as the browser sends it. */
function viaWorker(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  return fetch(`${worker.origin}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: worker.origin,
      ...(init.cookie ? { Cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    redirect: "manual",
  });
}

const sessionCookie = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

test("sign-up through the Worker sets a session cookie the Worker resolves", async () => {
  const signUp = await viaWorker("/api/auth/sign-up/email", {
    method: "POST",
    body: { email: "ada@example.com", password: PASSWORD, name: "Ada" },
  });
  expect(signUp.status, await signUp.clone().text()).toBe(200);
  const cookie = sessionCookie(signUp);
  expect(cookie).toBeTruthy();

  const res = await viaWorker("/api/auth/get-session", { cookie });
  const session = (await res.json()) as { user?: { email?: string } };
  expect(res.status, JSON.stringify(session)).toBe(200);
  expect(session.user?.email).toBe("ada@example.com");
});

test("sign-in through the Worker issues a Convex JWT that reaches the synced user", async () => {
  const signUp = await viaWorker("/api/auth/sign-up/email", {
    method: "POST",
    body: { email: "signin@example.com", password: PASSWORD, name: "Ada" },
  });
  const { user } = (await signUp.json()) as { user?: { id?: string } };

  const signIn = await viaWorker("/api/auth/sign-in/email", {
    method: "POST",
    body: { email: "signin@example.com", password: PASSWORD },
  });
  expect(signIn.status, await signIn.clone().text()).toBe(200);

  const tokenRes = await viaWorker("/api/auth/convex/token", { cookie: sessionCookie(signIn) });
  const { token } = (await tokenRes.json()) as { token?: string };
  expect(token, `token endpoint returned ${tokenRes.status}`).toBeTruthy();

  expect(await query(backend, "users:getCurrent", {}, { asToken: token })).toMatchObject({
    email: "signin@example.com",
    authUserId: user?.id,
  });
});

test("a server-rendered page sees the session cookie, and turns a visitor without one away", async () => {
  const signUp = await viaWorker("/api/auth/sign-up/email", {
    method: "POST",
    body: { email: "render@example.com", password: PASSWORD, name: "Ada" },
  });
  const cookie = sessionCookie(signUp);

  const signedIn = await viaWorker("/home", { cookie });
  expect(signedIn.status, await signedIn.clone().text()).toBe(200);

  const signedOut = await viaWorker("/home");
  expect(signedOut.status).toBeGreaterThanOrEqual(300);
  expect(signedOut.status).toBeLessThan(400);
  expect(signedOut.headers.get("location")).toContain("/login");
});
