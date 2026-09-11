// The one definition of "this page is showing a signed-in session", imported by
// auth-login.mjs and screenshot.mjs.
//
// Role + accessible name, never markup: an earlier version matched
// `a[href="/logout"]` and both scripts died silently the day sign-out became a
// button. A role and a name are a contract the UI keeps; an href is not.
export const SIGNED_IN = { role: "button", name: "Sign out" };

export const LOGIN_PATH = "/login";

export function signedInMarker(page) {
  return page.getByRole(SIGNED_IN.role, { name: SIGNED_IN.name, exact: true });
}

export function isLoginUrl(url) {
  return new URL(url).pathname.startsWith(LOGIN_PATH);
}

const never = () => new Promise(() => {});

// Races the marker against the form's error alert, so rejected credentials
// report their message at once instead of burning the whole timeout. A timeout
// says which of the two failures happened: never left the login page, or
// reached the app and did not find the marker.
export async function waitForSignedIn(page, { timeout = 60000, raceAlert = true } = {}) {
  const alert = page.getByRole("alert");
  const outcomes = [
    signedInMarker(page)
      .waitFor({ state: "visible", timeout })
      .then(() => "signed-in", never),
    page.waitForTimeout(timeout).then(() => "timeout"),
  ];
  if (raceAlert) {
    outcomes.push(alert.waitFor({ state: "visible", timeout }).then(() => "rejected", never));
  }

  const outcome = await Promise.race(outcomes);
  if (outcome === "signed-in") return;
  if (outcome === "rejected") {
    throw new Error(`sign-in rejected: ${(await alert.innerText()).trim()}`);
  }
  throw new Error(
    isLoginUrl(page.url())
      ? `still on the login page (${page.url()}) — the credentials were refused or the form never submitted`
      : `marker not found at ${page.url()} — the page loaded, but no ${SIGNED_IN.role} named "${SIGNED_IN.name}" appeared`,
  );
}
