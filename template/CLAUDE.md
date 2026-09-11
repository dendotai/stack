This project uses [Convex](https://convex.dev) as its backend.

**Convex backend** rules + agent skills live in `packages/api/CLAUDE.md` and
`packages/api/convex/_generated/ai/guidelines.md` (tool-managed, loaded on demand
when you work under `packages/api`). **Convex client** patterns (react-query reads,
optimistic updates) live in `apps/web/CLAUDE.md`. See
[ADR 0003](docs/adr/0003-convex-ai-files.md).

## Conventions

Follow the conventions of the frameworks and libraries we use (TanStack, Tailwind,
Convex, …) as closely as possible — the idiomatic, documented pattern is the
default. Treat **unintentional** divergence (drift, copy-paste, history artifacts)
as debt to revert toward the convention, not status quo to preserve. Diverge only
**deliberately**, to do something a convention genuinely can't — and when you do,
document *why* right at the divergence. When unsure what's idiomatic, check the
official docs instead of inventing.

Architecture decisions with non-obvious rationale live in `docs/adr/` — decisions
that look wrong/accidental but are deliberate, whose *why* isn't visible in the
code. See `docs/adr/README.md` for the bar and format. When you notice such a
decision being made or discussed — a deliberate choice likely to be re-questioned
later whose rationale isn't in the code — **proactively prompt the user to record
it as an ADR**; don't let it pass silently.

## Types

The Convex schema is the single source for data shapes — **derive every data
type from it**, so a schema change breaks the build instead of drifting silently:

- Docs/fields: `Doc<"users">`, `Doc<"users">["email"]` (`@stack/api/dataModel`).
- Query/action returns: `FunctionReturnType<typeof api.x.y>` (`convex/server`),
  `[number]` for a list element.
- Reader types: let `convexQuery` + `useQuery` infer them.

For a narrow prop, derive with `Pick<Doc<…>, …>`.

## Comments

A comment earns its place by adding something the code can't say itself — a *why*,
a non-obvious constraint, a deliberate divergence. Before writing one, check
whether it just restates the code or names what a type/identifier already makes
clear; if so, the code reads better without it.

A *why* still has to clear that bar: if the reason is already evident from the
code (e.g. `Pick<Doc<…>>` plainly being a narrowing), stating it adds nothing.
The test is whether a careful reader would actually be unsure without the comment.

## Commands

Document every `package.json` script in the nearest README: one concise line on
what it does plus an example invocation (show both the with-args and no-args
forms when both exist). Keep it short. Don't comment `package.json` itself — it's
strict JSON and comments break the Vite build in CI.

## Styling (Tailwind)

Use Tailwind idiomatically — strongly prefer the conventional, documented
approach over anything bespoke, so the styling stays recognizable and doesn't
drift into one-off patterns. Keep utilities inline; for reuse reach for built-in
utilities and components/partials, **not** extracted class-string constants,
global utility overrides, or `@apply`. When unsure, check the
[Tailwind docs](https://tailwindcss.com/docs/styling-with-utility-classes)
instead of inventing. Web specifics live in `apps/web/CLAUDE.md`.
