import { createFileRoute } from "@tanstack/react-router";

import { safeReturnPath } from "../../lib/auth-gate";
import { LoginPage } from "./-components/login-page";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnPathname: typeof search.returnPathname === "string" ? search.returnPathname : undefined,
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { returnPathname } = Route.useSearch();
  return <LoginPage returnPath={safeReturnPath(returnPathname)} />;
}
