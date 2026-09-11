# 0003. Convex AI files: keep as backend-only, colocate under `packages/api`

**Status:** Accepted

## Context

Convex's `ai-files` tooling installs a curated AI-assist layer: `guidelines.md`
(rules that override training-data misconceptions, pointed to from CLAUDE.md),
agent skills, and a managed CLAUDE.md/AGENTS.md section between
`<!-- convex-ai-* -->` markers. Three things look wrong or are easy to get wrong:

- The guidelines + skills are a **curated subset** focused on the Convex
  *backend* (schema, validators, function syntax). They do **not** cover
  client-side patterns — the trigger for this ADR was optimistic updates
  (`withOptimisticUpdate`), absent from the freshly-updated guidelines and every
  skill, so the default was a hand-rolled in-flight state machine until the
  pattern was pulled from docs manually. Treating the curated set as "Convex is
  covered" silently yields naive client code.
- The tooling writes files **relative to the dir it's run from**, and the managed
  CLAUDE.md section + skills land **together** in that project dir. Run it from
  the wrong place (or twice from different places) and you get mis-pathed,
  undiscovered duplicates — which is what happened while investigating this
  (root vs `packages/api` copies drifting).
- The CLAUDE.md block is **tool-owned between markers**; deleting only the
  markers makes the next `update` inject a second copy.

Tempting alternative #1 — delete the ai-files and "just read the docs" — is
wrong: `guidelines.md` is *push* context (always in window via the CLAUDE.md
pointer) that corrects backend misconceptions you wouldn't know to look up; docs
are *pull*. Throwing it out loses the backend guard without fixing the client gap.

Tempting alternative #2 — put everything at the repo root so Claude "definitely
sees it" — is unnecessary: Claude Code discovers nested `.claude/skills/` and
nested `CLAUDE.md` **on demand** when working in a subtree (CC docs). So backend
AI files colocated under `packages/api` load precisely when backend code is
touched.

## Decision

- **Keep** `guidelines.md` and all Convex skills, scoped explicitly as
  **backend-only** curated rules.
- **Colocate the whole tool-managed set under `packages/api`** by running
  `npx convex ai-files install|update` **from `packages/api`**: guidelines
  (`convex/_generated/ai/`), skills (`packages/api/.claude/skills/`), and the
  managed `packages/api/CLAUDE.md` section. **Remove the legacy root copies.**
- Keep a **one-line pointer in root `CLAUDE.md`** to `packages/api/CLAUDE.md`,
  since nested CLAUDE.md/skills load lazily and backend reasoning may begin
  before a backend file is opened.
- Put Convex **client** conventions (react-query reads, `withOptimisticUpdate`)
  in **`apps/web/CLAUDE.md`** — loaded on demand for frontend work, where those
  patterns are used.
- **Pin skills to `claude-code`** in `packages/api/convex.json` so updates don't
  re-add the codex/`.agents` set.
- **Standing rule:** for any Convex client-side concern (mutations,
  subscriptions, pagination, optimistic UI), consult `docs.convex.dev` before
  defaulting — the curated set won't cover it; capture adopted patterns in the
  relevant CLAUDE.md.

## Consequences

- **Positive:** backend misconception-guard retained and colocated with the
  backend; client patterns get a real discovery path (docs habit +
  `apps/web/CLAUDE.md`); one canonical home per file, loaded when relevant; no
  codex duplication.
- **Accepted trade-off:** nested CLAUDE.md/skills load lazily, so the backend set
  isn't guaranteed at session start — mitigated by the one-line root pointer. The
  managed block must be maintained via `ai-files`, not hand-edited.
  `AGENTS.md` regenerates under `packages/api` on every `update` (no opt-out) and
  is deleted here (claude-only); re-delete after an `update` if undesired.
- **Open:** if the curated set grows to cover client patterns upstream, revisit
  the "docs-first for client" rule. If Claude Code ever drops nested-dir skill
  discovery, the colocation would have to move to the repo root.
