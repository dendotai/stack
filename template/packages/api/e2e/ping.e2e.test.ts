import { afterAll, beforeAll, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { deploy, query } from "./deployment";
import { type LocalBackend, startBackend } from "./local-backend";

let backend: LocalBackend;

beforeAll(async () => {
  backend = await startBackend();
  await deploy(backend);
});

afterAll(async () => {
  await backend?.stop();
});

test("a deployed query answers over HTTP from the local backend", async () => {
  expect(await query(backend, api.ping.ping, {})).toMatchObject({ ok: true });
});
