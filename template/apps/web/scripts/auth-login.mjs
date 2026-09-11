// Signs in through the app's own login form and saves a reusable Playwright
// session to `.auth/state.json`. `screenshot.mjs` then reuses that state
// headlessly — no re-login until the session expires.
//
// Two modes:
//   • Automated  — if `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are set (in
//     `.dev.vars`, a dedicated test account on the dev deployment), fills the
//     form headlessly. No human needed.
//   • Interactive — otherwise opens a real browser window for you to sign in.
//
//   bun run auth:login            # default base https://stack.internal
//   HEADED=1 bun run auth:login   # watch the automated login (debug)
//
// `.auth/` (the saved session) is gitignored; the test creds live in the
// gitignored `.dev.vars` — env vars, not a file in the repo.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { waitForSignedIn } from "./selectors.mjs";

function parseEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const BASE = process.env.STACK_BASE_URL ?? "https://stack.internal";
const STATE = fileURLToPath(new URL("../.auth/state.json", import.meta.url));
const DEBUG_SHOT = fileURLToPath(new URL("../.auth/login-debug.png", import.meta.url));

const env = parseEnv(fileURLToPath(new URL("../.dev.vars", import.meta.url)));
const creds =
  env.TEST_USER_EMAIL && env.TEST_USER_PASSWORD
    ? { email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }
    : null;
const automated = creds !== null;
const headed = process.env.HEADED === "1" || !automated;

// The form's submit stays disabled until the page hydrates, so that transition
// is the signal that a click will reach the handler rather than the browser's
// own submission (#28).
//
// `click()` waits for the same thing on its own. This loop exists only for the
// message: a hydration failure otherwise reads as a generic click timeout, and
// that misdiagnosis is exactly what #30 is about.
async function waitForEnabled(locator, timeout = 30000) {
  await locator.waitFor({ state: "visible", timeout });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return;
    await locator.page().waitForTimeout(100);
  }
  throw new Error("the submit button never became enabled — the login page did not hydrate");
}

async function automatedLogin(page) {
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await waitForEnabled(submit);
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await submit.click();
  await waitForSignedIn(page);
}

async function interactiveLogin(page) {
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
  console.log("\n  A browser window opened. Sign in there.");
  console.log(`  Waiting until ${BASE} renders signed-in (up to 5 min)…\n`);
  // No alert race here: a human can retype a wrong password without the script
  // giving up on the first rejection.
  await waitForSignedIn(page, { timeout: 5 * 60 * 1000, raceAlert: false });
}

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
const page = await context.newPage();

try {
  if (automated) {
    console.log(`  Logging in as ${creds.email} (automated)…`);
    await automatedLogin(page);
  } else {
    await interactiveLogin(page);
  }
  mkdirSync(dirname(STATE), { recursive: true });
  await context.storageState({ path: STATE });
  console.log(`  ✓ Session saved to ${STATE}`);
} catch (err) {
  await page.screenshot({ path: DEBUG_SHOT, fullPage: true }).catch(() => {});
  console.error(`  ✗ Login failed: ${err.message}`);
  console.error(`    Saved a debug screenshot to ${DEBUG_SHOT}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
