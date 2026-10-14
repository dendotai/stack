import type { api } from "@stack/api";
import type { FunctionReturnType } from "convex/server";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useSetSetting } from "../lib/use-set-setting";

export type Theme = FunctionReturnType<typeof api.settings.getForCaller>["theme"];

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeSelect({ theme }: { theme: Theme }) {
  const setSetting = useSetSetting();
  return (
    <NativeSelect
      size="sm"
      aria-label="Theme"
      value={theme}
      onChange={(event) => {
        const picked = THEMES.find((option) => option.value === event.target.value);
        if (picked) void setSetting({ setting: { key: "theme", value: picked.value } });
      }}
    >
      {THEMES.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
