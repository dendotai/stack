# apps/web — agent notes

## Convex data & mutations

Reads go through **`@convex-dev/react-query`** (`convexQuery` + TanStack
`useQuery`), not raw `useQuery` from `convex/react`. The skeleton's `/home` route
is the reference: a route `loader` calls
`queryClient.ensureQueryData(convexQuery(api.users.getCurrent, {}))` and the
component reads the same key with `useQuery(convexQuery(...))`, so the data is
prefetched during SSR and shared across mounts.

For a mutation that changes a **visible** list or item state (move/remove/status
flip), prefer an **optimistic update** —
`useMutation(ref).withOptimisticUpdate((localStore, args) => …)` — over
hand-rolled in-flight/`disabled`/"…ing" state: the UI updates instantly and
Convex rolls back automatically on failure. It propagates through the react-query
layer (the integration bridges `watchQuery().onUpdate()` → `setQueryData`).

The Convex curated guidelines (`packages/api/.../guidelines.md`) are **backend
only** — they don't cover client patterns. For anything client-side (mutations,
subscriptions, pagination, optimistic UI), **consult `docs.convex.dev` before
defaulting**, then capture what you adopt here. See
[ADR 0003](../../docs/adr/0003-convex-ai-files.md).

## Page layout

Signed-in app routes (everything under `_app`, e.g. `/home`) render inside the
**`_app` pathless layout route** (`src/routes/_app.tsx`) — the TanStack Router
convention for a shared layout. It provides the frame
(`<main>` + `container mx-auto px-4`) around `<Outlet/>`; routes just render their
content. `TopNav` (`__root.tsx`) uses the same `container mx-auto px-4`, so nav
and content stay aligned. Landing (`/`) and login render *outside* `_app`, so
they keep their own full-screen layouts.

The frame uses Tailwind's `container` composed inline (the documented idiom —
`container` itself doesn't center or pad; don't override it globally). **To opt
content into a narrower column, wrap it in `mx-auto max-w-xl` etc. inside the
route — don't change the frame.** Prefer this over a custom width wrapper.

## Tailwind / styling conventions

Utility-first: **keep classes inline in the markup** — that's the point. Per the
[Tailwind docs](https://tailwindcss.com/docs/styling-with-utility-classes),
inline utilities keep changes local, code portable, and CSS from growing. Don't
reach for abstraction reflexively.

For duplicated class lists, follow Tailwind's own order:
1. Rendered in a loop → already authored once; leave it.
2. Duplicated within one file → multi-cursor edit; no abstraction needed.
3. Reused across files → use a built-in utility (e.g. `container`) or extract a
   **component** with the classes inline in it.
4. `@apply` / custom CSS only as a last resort.

**Don't extract Tailwind class strings into JS constants** (e.g.
`const FRAME_X = "px-3 sm:px-8"`): it loses IntelliSense + class sorting and
fights co-location. When two elements must share styling (e.g. nav/content
alignment), share a built-in utility or a **component**, not a string.
Compose/override classes with `cn()` (`lib/utils.ts` — clsx + tailwind-merge).

## Visual verification: screenshot the running app signed-in

To confirm a UI change in the real app (not just tests), **capture signed-in
screenshots yourself** instead of asking the user:

1. Dev server running (`bun dev` from repo root), reachable at
   `https://stack.internal` (or set `STACK_BASE_URL`). See `scripts/README.md`.
2. One-time per session: `cd apps/web && bun run auth:login` — saves a reusable
   Playwright session to `.auth/state.json`. A dedicated WorkOS test user, with
   `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` in the gitignored `.dev.vars`, makes
   this fully automated — no human step.
3. `bun run screenshots [routes…]` → PNGs in `screenshots/`. Then Read the PNGs
   to verify.

**Why there's no shortcut:** every route but `/` and `/login` is WorkOS-gated,
and Convex validates the token as a real WorkOS JWT — a mock user can't read the
data. So headless capture needs a genuine session.

**Gotchas already handled in the scripts** (`scripts/README.md` has the rest):
- Hosted WorkOS login may render in a non-English locale → context forces
  `locale: en-US` and submits language-agnostically.
- The live Convex WebSocket means `networkidle` never settles → use
  `domcontentloaded` waits.
- Re-run `auth:login` if `screenshots` reports the session expired.
