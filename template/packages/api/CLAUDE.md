<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Schema and auth changes reach prod in order

Prod is the target: a change is done when it can reach prod from prod's deployed state, not when `dev` is green. See [ADR 0008](../../docs/adr/0008-prod-is-the-target.md).

Before changing `convex/schema.ts`, `convex/auth.ts` or `convex/auth.config.ts`, list the commits to those files that prod does not have yet:

```bash
git fetch && git log origin/main..origin/dev -- ':/packages/api/convex/schema.ts' ':/packages/api/convex/auth.ts' ':/packages/api/convex/auth.config.ts'
```

- A change that only adds (an optional field, a table, an index) goes ahead, whatever the list holds.
- A change that tightens or removes (requires a field, drops a field or a table, changes a type, reshapes auth) depends on the release before it. When that release is in the list, or its prod deploy or its backfill on prod has not finished, stop and state the release sequence prod needs before writing code: promote `dev` to `main`, let the prod deploy finish, finish the backfill on prod, then make the change.
- After a PR that changes one of these files merges into `dev`, promote `dev` to `main`.

The `convex-migration-helper` skill holds the widen → migrate → narrow steps.
