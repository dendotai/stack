import { api } from "@stack/api";
import { useMutation } from "convex/react";

// Every control that changes a setting writes through this hook (ADR 0010), so the optimistic update of `getForCaller` lives in one place.
export function useSetSetting() {
  return useMutation(api.settings.set).withOptimisticUpdate((store, { setting }) => {
    const current = store.getQuery(api.settings.getForCaller, {});
    if (current) {
      store.setQuery(api.settings.getForCaller, {}, { ...current, [setting.key]: setting.value });
    }
  });
}
