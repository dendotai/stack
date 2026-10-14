import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

const setSetting = vi.hoisted(() => vi.fn());
vi.mock("../lib/use-set-setting", () => ({ useSetSetting: () => setSetting }));

import { ThemeSelect } from "./theme-select";

afterEach(() => {
  cleanup();
  setSetting.mockClear();
});

test("shows the stored theme", () => {
  render(<ThemeSelect theme="light" />);
  expect(screen.getByRole("combobox", { name: "Theme" })).toHaveValue("light");
});

test("a pick goes through the one settings write path", async () => {
  render(<ThemeSelect theme="system" />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Theme" }), "dark");
  expect(setSetting).toHaveBeenCalledWith({ setting: { key: "theme", value: "dark" } });
});
