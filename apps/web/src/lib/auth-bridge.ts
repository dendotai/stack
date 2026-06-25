import { useAccessToken, useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useCallback, useMemo } from "react";

// Bridges WorkOS AuthKit into the shape ConvexProviderWithAuth expects:
// `{ isLoading, isAuthenticated, fetchAccessToken }`. ConvexReactClient calls
// `fetchAccessToken({ forceRefreshToken })` when it needs to attach a token.
export function useAuthFromAuthKit() {
  const { loading, user } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      const token = forceRefreshToken ? await refresh() : await getAccessToken();
      return token ?? null;
    },
    [user, refresh, getAccessToken],
  );

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken],
  );
}
