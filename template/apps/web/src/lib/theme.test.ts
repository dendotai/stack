import { afterEach, expect, test } from "vitest";
import type { Theme } from "@/components/theme-select";
import { THEME_SCRIPT } from "./theme";

// jsdom has no matchMedia; this one lets a test flip the OS setting.
function fakeOs(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: "change", fn: () => void) => listeners.add(fn),
  };
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      query.matches = next;
      for (const fn of listeners) fn();
    },
  };
}

function run(theme?: Theme) {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  new Function(THEME_SCRIPT)();
  return root;
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
});

test("dark applies the dark class whatever the OS says", () => {
  fakeOs(false);
  expect(run("dark").classList.contains("dark")).toBe(true);
});

test("light keeps the page light on a dark OS", () => {
  fakeOs(true);
  expect(run("light").classList.contains("dark")).toBe(false);
});

test("system, or no theme at all, follows the OS", () => {
  fakeOs(true);
  expect(run("system").classList.contains("dark")).toBe(true);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
  expect(run().classList.contains("dark")).toBe(true);
});

test("system follows an OS change after the page loaded", () => {
  const os = fakeOs(false);
  const root = run("system");
  expect(root.classList.contains("dark")).toBe(false);
  os.set(true);
  expect(root.classList.contains("dark")).toBe(true);
});

test("a new data-theme value applies without a reload", async () => {
  fakeOs(false);
  const root = run("system");
  root.dataset.theme = "dark";
  await tick();
  expect(root.classList.contains("dark")).toBe(true);
});
