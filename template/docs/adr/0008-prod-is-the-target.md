# 0008. Prod is the target: a change is done when it can reach prod

**Status:** Accepted

## Context

Changes merge into `dev` and reach prod when `dev` is promoted to `main`. Between promotions, `dev` holds commits prod does not have, and nothing in the flow limits how many.

Convex validates the schema against the live data at deploy time and keeps no log of migrations to replay. A change that takes two releases — make a field optional and backfill it, then drop the field — assumes every deployment runs the first release before the second. If both releases sit on `dev` unpromoted, the next promotion sends them to prod at once, and the deploy fails because prod's data still matches only the old schema. `dev` being green proves nothing: `dev` ran the releases in order, prod did not.

Drift alone is harmless. Adding changes (a new optional field, a new table, a new index) stack and promote together in one release. The failure needs an ordering dependency: a change that tightens or removes (requires a field, drops a field or a table, changes a type, reshapes auth) while the release before it is not yet on prod. Merged to `main` is not enough either: the earlier release has to be deployed to prod and its backfill finished there.

Letting `dev` run ahead buys nothing: `dev` has no users and no traffic, so time on `dev` tests nothing a deploy does not.

## Decision

- Prod is the target environment, and `dev` exists to keep prod from breaking. A change is done when it can reach prod from prod's deployed state, not when `dev` is green.
- After each merged PR that changes `convex/schema.ts`, `convex/auth.ts` or `convex/auth.config.ts`, promote `dev` to `main`. Other changes go out with any later promotion.
- Before a change that tightens or removes, read which schema and auth commits prod lacks. When one of them is the release this change depends on, promote and deploy it, finish its backfill on prod, and only then write the change. The release sequence is stated before the code.
- The rule and its command live in `packages/api/CLAUDE.md`, where the schema lives.

## Consequences

- **Positive:** a two-release change meets prod in the order it was written, and the need for a second release shows up when the change is written, not at promotion.
- **Accepted trade-off:** more promotions, each a `dev` → `main` PR. The check depends on whoever edits the schema reading the rule.

## Rejected

- **A Claude Code hook that prints the drift when `schema.ts` or the auth config is edited:** it covers one editor only, and the rule in `packages/api/CLAUDE.md` loads in the same moments.
- **A CI check on PRs into `dev` that warns when the PR and an unpromoted `dev` commit both change a guarded file:** it also warns on two adding changes in a row, which are safe, so its warnings get ignored. The variant that reads the Convex validators to flag only tightening changes is code that must track Convex's validator syntax.
