This repo holds the `dendotai/stack` starter template plus, over time, its
marketing site and tooling. The template is the `template/` directory.

## What is where

- `template/` is what a downstream project receives, byte for byte. It is a
  complete bun monorepo with its own `package.json`, `bun.lock`, `biome.json`
  and `.github/workflows/`. It is **not** a workspace member of this root
  (bun workspaces do not nest). Run its checks inside it: `cd template && bun
  run check`, or `bun run check` from the root.
- Root `apps/` and `packages/` are this repo's own products (marketing site,
  bootstrap CLI). `template/apps/` and `template/packages/` are the downstream
  project's. Same names, different owners — never mix them.
- `template/.github/workflows/` are the downstream projects' workflows. GitHub
  never runs nested workflow files, so they are inert here. This repo's own
  automation lives in the root `.github/workflows/`.
- Conventions for the template's code are in `template/CLAUDE.md`.

## Where new work lands

Ask: does a downstream project need this file? Yes → under `template/`
(fixes and features of the starter, its docs, ADRs, SETUP.md, its workflows).
No → at the root (repo tooling, the site, the CLI, this repo's CI).

## Reading issues

Issues filed before 2026-09-11 predate the move: the template was the repo
root. A path like `apps/web/src/...` or `docs/SETUP.md` in such an issue means
`template/apps/web/src/...` or `template/docs/SETUP.md` today. Mentions of
`.github/workflows/deploy.yml` mean `template/.github/workflows/deploy.yml`.
