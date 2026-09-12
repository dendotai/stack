# 0005. Route files export only `Route`; each route is a colocated folder

**Status:** Accepted

## Context

TanStack Start code-splits a route's render path automatically: the Vite plugin
lifts the `component` (and `errorComponent`, `pendingComponent`, …) out of the
route file into a separate chunk, so the eager route bundle keeps only the
route's config — `beforeLoad`, `loader`, `head`.

A second **named export** in the same file silently defeats that. The splitter
cannot move code that another module may import by name, so it leaves the
component in the eager bundle. Nothing fails; the build just gets bigger, and
every route added the same way makes the first paint slower.

The tempting shape is exactly the one that breaks it. A route file that both
sets `component: Home` and does `export function Home()` looks tidy, and the
export usually exists for one reason: a test wants to render the component
without the router. So the test — a file that never ships — decides the
production chunk layout.

The natural fix, moving the component to `src/components/`, trades one problem
for another: a route's pieces scatter across the tree, and `components/` fills
up with things exactly one route uses. ADR 0002 already rejected that reasoning
for hooks.

## Decision

**`Route` is a route file's only value export.** A type export is fine — it is
erased before bundling, so it cannot pin a component in the eager chunk
(`__root.tsx` exports `RouterAppContext` this way).

The component moves to a `-components/` directory next to the route file. A
route that owns a second file — a test, a hook, more than one component — gets
its own directory, so those files sit beside it rather than in the shared
`routes/-components/`:

```
routes/_app/
  route.tsx                     ← layout route, exports only `Route`
  -components/app-layout.tsx
  home/
    route.tsx                   ← exports only `Route`
    -components/home.tsx        ← exports `Home`
    home.test.tsx               ← imports `./-components/home`
```

- `route.tsx` is TanStack Router's directory form of a route file. It imports
  the component and passes it to `component:`; an imported identifier is not a
  named export, so the splitter still lifts the render path out.
- `-components/` and `-hooks/` use the `-` prefix the generator excludes from
  the route tree (ADR 0002).
- Tests sit beside the route they cover. They are excluded from the route scan
  by `routeFileIgnorePattern: ".*\\.test\\.tsx?$"` in `tanstackStart()` — the
  generator otherwise warns once per build for every file under `routes/` that
  exports no `Route`.
- A route with **no** component (a server handler like `/api/auth/$`, or a
  plain redirect) stays a single flat file with no `-components/` at all.
- Landing is the one-file case: `index.tsx` plus
  `routes/-components/landing.tsx`. It gets a directory the day it gains a test.
- Layout routes follow the same shape: `_app/route.tsx` +
  `_app/-components/app-layout.tsx`, with the child routes as sibling folders.
- `__root.tsx` is the one exception and keeps its shell and nav inline. Every
  page renders the root, so there is nothing to defer — splitting it is not
  possible, only rearranging.

## Consequences

- **Positive:** automatic code-splitting keeps working as routes are added. The
  eager bundle holds route config only. A route's component, hooks and tests sit
  together, so a reader (or agent) opening the folder sees the whole route.
- **Positive:** both halves are mechanical — one value export per route file,
  and a directory as soon as a second file appears. Neither asks whether a
  component is "big enough" to split.
- **Accepted trade-off:** one more file per route, and one more directory level
  for routes that own a test. For a ten-line component that is overhead; the
  consistency is what makes the rule enforceable, so pay it anyway.
- **Accepted trade-off:** the component is reachable from outside the route
  (nothing stops an import of `-components/home`). The `-` prefix marks it as
  route-private by convention, not by the compiler. If a second route needs it,
  promote it to `src/components/` — same rule ADR 0002 gives for hooks.
- **Open:** nothing enforces the single-value-export rule yet. A lint rule over
  `routes/**` would; until then the loss is silent, so check the client chunk
  list when adding a route.
