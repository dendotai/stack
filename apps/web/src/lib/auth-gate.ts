// Default-deny route gate: every path is protected unless it's in this allowlist.
// Keep public surface tight — adding a route here means unauthenticated users can hit it.
const PUBLIC_PATHS = new Set<string>(["/", "/login"]);
const PUBLIC_PREFIXES = ["/api/auth/"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
