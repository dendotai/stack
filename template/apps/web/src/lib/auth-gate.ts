// Default-deny route gate: every path is protected unless it's in this allowlist.
// Keep public surface tight — adding a route here means unauthenticated users can hit it.
const PUBLIC_PATHS = new Set<string>(["/", "/login"]);
const PUBLIC_PREFIXES = ["/api/auth/"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Where the login page sends a visitor once signed in. The value arrives in a
// query string, so anything but a path within this app is an open redirect:
// `//evil.example` and `https://evil.example` are both absolute URLs to a
// browser. A backslash is folded to `/` by browsers, so `/\evil.example` is
// protocol-relative too.
export function safeReturnPath(value: string | undefined): string {
  if (!value?.startsWith("/")) return "/home";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/home";
  return value;
}
