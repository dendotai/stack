import type { ConvexQueryClient } from "@convex-dev/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ConvexAuthProvider } from "../lib/auth-bridge";
import { authClient } from "../lib/auth-client";
import { isPublicPath } from "../lib/auth-gate";
import { getSessionToken } from "../lib/auth-session";
import appCss from "../styles.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  beforeLoad: async ({ context, location }) => {
    const sessionToken = await getSessionToken();
    if (!sessionToken && !isPublicPath(location.pathname)) {
      throw redirect({
        to: "/login",
        // `href`, not `pathname`: a deep link's query string is part of the
        // page the visitor asked for.
        search: { returnPathname: location.href },
      });
    }
    // Lets route loaders prefetch auth-protected Convex queries during server
    // render. The serverHttpClient only exists on the server; on client-side
    // navigations this is a no-op.
    if (sessionToken) context.convexQueryClient.serverHttpClient?.setAuth(sessionToken);
    // Child routes read this instead of resolving the session a second time.
    return { sessionToken };
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
  const { sessionToken } = Route.useRouteContext();
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ConvexAuthProvider initialToken={sessionToken}>
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
        </ConvexAuthProvider>
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

// Signed-in state comes from the root route's context, not from the auth
// client's session hook: the server already resolved it, so the nav renders
// correctly in the first byte and an anonymous visitor makes no auth request.
// Both sign-in and sign-out navigate the whole document, so it never goes stale.
function TopNav() {
  const { sessionToken } = Route.useRouteContext();
  const signedIn = sessionToken !== null;
  const visible = NAV_LINKS.filter((link) => {
    if (link.auth === "any") return true;
    return link.auth === "in" ? signedIn : !signedIn;
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
          {signedIn ? (
            <SignOutButton />
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

// A button, not a link: signing out is an action, and a GET-navigable `/logout`
// is something a browser or a link prefetch can fire on its own. Its role and
// name are also the signed-in marker the screenshot scripts look for
// (`scripts/selectors.mjs`).
function SignOutButton() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground"
      onClick={async () => {
        await authClient.signOut();
        // The cache holds the signed-out user's rows; a persister would keep
        // them on disk for the next visitor on this device.
        queryClient.clear();
        // Full navigation so the root route re-resolves the session server-side.
        window.location.href = "/";
      }}
    >
      Sign out
    </button>
  );
}
