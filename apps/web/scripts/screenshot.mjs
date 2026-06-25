// Headless screenshots of the dev app, reusing the saved WorkOS session.
// Run `bun run auth:login` once first. See scripts/README.md for details.
//
//   bun run screenshots /home     # with args: capture only the route(s) you name
//   bun run screenshots           # no args: sweep /home
//
// Output PNGs land in `screenshots/` (gitignored). Exits non-zero if the session
// has expired, so callers can tell a redirect-to-login apart from a real capture.

import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.STACK_BASE_URL ?? "https://stack.internal";
const STATE = fileURLToPath(new URL("../.auth/state.json", import.meta.url));
const OUT_DIR = fileURLToPath(new URL("../screenshots/", import.meta.url));

// Routes captured when no args are passed. Add your app's routes here.
const DEFAULT_ROUTES = ["/home"];

if (!existsSync(STATE)) {
  console.error("  No saved session at .auth/state.json — run: bun run auth:login");
  process.exit(1);
}

function isLoginUrl(url) {
  const u = new URL(url);
  return u.hostname.includes("authkit.app") || u.pathname.startsWith("/login");
}

function fileFor(route) {
  const slug = route === "/" ? "root" : route.replace(/^\/+/, "").replace(/[/$]+/g, "_");
  return `${OUT_DIR}${slug}.png`;
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: STATE,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

async function capture(route) {
  // The app holds a live Convex WebSocket, so "networkidle" never settles —
  // wait for the document + the authed nav, then a short beat for assets.
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  if (isLoginUrl(page.url())) {
    console.error(
      `  ✗ ${route}: redirected to login — session expired. Re-run: bun run auth:login`,
    );
    return false;
  }
  await page
    .locator('a[href="/logout"]')
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {});
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1200);
  const file = fileFor(route);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ✓ ${route} → ${file}`);
  return true;
}

const argRoutes = process.argv.slice(2);
const routes = argRoutes.length > 0 ? argRoutes : DEFAULT_ROUTES;
let expired = false;

for (const route of routes) {
  if (!(await capture(route))) expired = true;
}

await browser.close();
process.exit(expired ? 1 : 0);
