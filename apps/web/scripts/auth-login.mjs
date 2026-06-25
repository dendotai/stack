// WorkOS login that saves a reusable Playwright session to `.auth/state.json`.
// `screenshot.mjs` then reuses that state headlessly — no re-login until the
// WorkOS session expires.
//
// Two modes:
//   • Automated  — if `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are set (in
//     `.dev.vars`, a dedicated WorkOS test user), fills the hosted login form
//     headlessly. No human needed.
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
const AUTHED = 'a[href="/logout"]'; // nav renders this only when signed in

const env = parseEnv(fileURLToPath(new URL("../.dev.vars", import.meta.url)));
const creds =
  env.TEST_USER_EMAIL && env.TEST_USER_PASSWORD
    ? { email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }
    : null;
const automated = creds !== null;
const headed = process.env.HEADED === "1" || !automated;

async function fillFirst(page, selectors, value) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.fill(value);
      return true;
    }
  }
  return false;
}

// Submit the current step language-agnostically — the hosted page may render in
// any locale, so match the submit button by type, not by text. Fall back to
// pressing Enter in the field we just filled.
async function advance(page, fieldSel) {
  const submit = page.locator('button[type="submit"]').first();
  if ((await submit.count()) > 0 && (await submit.isVisible().catch(() => false))) {
    await submit.click().catch(() => {});
  } else {
    await page
      .locator(fieldSel)
      .first()
      .press("Enter")
      .catch(() => {});
  }
}

async function automatedLogin(page) {
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" }).catch(() => {});
  const emailSel = ['input[type="email"]', 'input[name="email"]', 'input[name="identifier"]'].join(
    ", ",
  );
  const pwSel = ['input[type="password"]', 'input[name="password"]'].join(", ");

  await page.locator(emailSel).first().waitFor({ state: "visible", timeout: 30000 });
  await fillFirst(page, [emailSel], creds.email);

  // Single-page (email + password together) or two-step — handle both.
  const pwVisible = await page
    .locator(pwSel)
    .first()
    .isVisible()
    .catch(() => false);
  if (!pwVisible) {
    await advance(page, emailSel);
    await page.locator(pwSel).first().waitFor({ state: "visible", timeout: 30000 });
  }
  await fillFirst(page, [pwSel], creds.password);
  await advance(page, pwSel);

  await page.locator(AUTHED).waitFor({ state: "visible", timeout: 60000 });
}

async function interactiveLogin(page) {
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" }).catch(() => {});
  console.log("\n  A browser window opened. Complete the WorkOS sign-in there.");
  console.log(`  Waiting until ${BASE} renders signed-in (up to 5 min)…\n`);
  await page.locator(AUTHED).waitFor({ state: "visible", timeout: 5 * 60 * 1000 });
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
