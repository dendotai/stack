- **`Route` is a route file's only value export** (`apps/web`,
  [ADR 0005](docs/adr/0005-route-component-colocation.md)): a second named export
  stops TanStack Start from code-splitting the route's render path, so the
  component stays in the eager bundle. The component moves to `-components/`
  beside the route, and a route owning a second file becomes a folder —
  `routes/_app.home.tsx` is now `routes/_app/home/{route.tsx,
  -components/home.tsx, home.test.tsx}`, `routes/_app.tsx` is
  `routes/_app/{route.tsx, -components/app-layout.tsx}`, and `routes/login.tsx`
  is `routes/login/{route.tsx, -components/login-page.tsx, login.test.tsx}`;
  landing keeps a flat `index.tsx` with `routes/-components/landing.tsx`, and
  `__root.tsx` keeps its shell inline because every page renders it.
  `vite.config.ts` passes
  `router: { routeFileIgnorePattern: ".*\\.test\\.tsx?$" }` to `tanstackStart()`
  so colocated tests stay out of the route scan. ADR 0002 gains an update note:
  a route-only hook now lives in its own route folder's `-hooks/`, not the
  shared `routes/-hooks/`. To apply: move each route that exports a component
  into `routes/<path>/route.tsx` + `-components/<name>.tsx`, drop the component
  export from the route file, add the `routeFileIgnorePattern` option, then
  rebuild to regenerate `routeTree.gen.ts`.
