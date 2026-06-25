# 0002. Route-scoped hook colocation under `routes/-hooks/`

**Status:** Accepted

## Context

A custom hook used by exactly one route (non-rendering logic for a single screen)
needs a home. The conventional-looking options each have a cost:

- **Inline in the route file** — bloats the route with non-rendering logic and
  its private helpers; the route stops reading as "what this screen renders."
- **`lib/`** — that's where genuinely *shared* hooks live. Putting a single-route
  hook there overstates its reach and scatters a route's pieces across the tree.
- **A top-level `src/hooks/` dir** — collects all hooks in one place, but pulls
  route-specific logic *away* from the route that owns it, the opposite of
  colocation.

TanStack Router's file-based routing turns files under `routes/` into routes —
so the natural "put it next to the route" instinct is normally blocked: a hook
file under `routes/` would be misread as a route.

## Decision

Colocate a **route-only** hook in a `-`-prefixed directory beside its route, e.g.
`apps/web/src/routes/-hooks/use-thing.ts`.

TanStack Router **excludes any file or directory whose name starts with `-`**
from the generated route tree. So `routes/-hooks/` lives inside `routes/`,
adjacent to the route that uses it, **without** becoming a route. The hook's
private helpers and types move into the same file; the route keeps only its
render-path code and imports the hook.

Scope rule: **route-only → `routes/-hooks/`; shared across routes → `lib/`.**

## Consequences

- **Positive:** a route's logic sits next to the route; `lib/` stays reserved for
  genuinely shared code; one-file-per-hook keeps each hook independently
  readable and testable.
- **Accepted trade-off:** relies on a framework-specific naming rule (the `-`
  prefix). Someone unaware of it may see a non-route file under `routes/` and try
  to "fix" it by moving it to `lib/` or a top-level `hooks/` dir. **That is the
  thing this ADR exists to prevent** — the placement is deliberate, not a
  misfile. Verify the rule still holds (`routeTree.gen.ts` must not reference
  `-hooks`) if TanStack Router's exclusion behavior ever changes.
- **Open:** if a `-hooks` hook later gains a second consumer, promote it to
  `lib/` at that point — colocation is for single-route ownership, not a
  permanent address.
