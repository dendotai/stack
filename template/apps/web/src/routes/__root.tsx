import type { ConvexQueryClient } from "@convex-dev/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { AuthKitProvider, useAuth } from "@workos/authkit-tanstack-react-start/client";
import { ConvexProviderWithAuth } from "convex/react";

import { useAuthFromAuthKit } from "../lib/auth-bridge";
import { isPublicPath } from "../lib/auth-gate";
import { convex } from "../lib/convex";
import appCss from "../styles.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  beforeLoad: async ({ context, location }) => {
    if (isPublicPath(location.pathname)) return;
    const auth = await getAuth();
    if (!auth.user) {
      throw redirect({
        to: "/login",
        search: { returnPathname: location.pathname },
      });
    }
    // Attach the WorkOS access token to the SSR HTTP client so route loaders
    // can prefetch auth-protected Convex queries during server render. The
    // serverHttpClient only exists on the server; on client-side navigations
    // this is a no-op.
    context.convexQueryClient.serverHttpClient?.setAuth(auth.accessToken);
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "stack" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthKitProvider>
          <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
            <TopNav />
            {children}
            {import.meta.env.DEV && (
              <TanStackDevtools
                config={{ position: "bottom-right" }}
                plugins={[
                  {
                    name: "TanStack Router",
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                ]}
              />
            )}
          </ConvexProviderWithAuth>
        </AuthKitProvider>
        <Scripts />
      </body>
    </html>
  );
}

type NavLink = { to: string; label: string; auth: "in" | "out" | "any" };

const NAV_LINKS: readonly NavLink[] = [
  { to: "/", label: "Home", auth: "out" },
  { to: "/home", label: "Home", auth: "in" },
];

function TopNav() {
  const { loading, user } = useAuth();
  const visible = NAV_LINKS.filter((link) => {
    if (link.auth === "any") return true;
    return link.auth === "in" ? !!user : !user;
  });

  // Same `container mx-auto px-4` as page content → nav and content stay aligned.
  return (
    <nav className="border-b border-border">
      <div className="container mx-auto flex items-center gap-4 px-4 py-3 text-sm">
        {visible.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="inline-grid text-muted-foreground hover:text-foreground"
            activeProps={{ "aria-current": "page", className: "text-foreground font-bold" }}
            activeOptions={{ exact: true }}
          >
            <span aria-hidden className="invisible font-bold col-start-1 row-start-1">
              {link.label}
            </span>
            <span className="col-start-1 row-start-1">{link.label}</span>
          </Link>
        ))}
        <div className="ml-auto">
          {loading ? null : user ? (
            <a href="/logout" className="text-muted-foreground hover:text-foreground">
              Sign out
            </a>
          ) : (
            <a href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
