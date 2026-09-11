This repo holds the `dendotai/stack` starter template plus, over time, its
marketing site and tooling. The template is the `template/` directory.

- `template/` is what a downstream project receives, byte for byte. It is a
  complete bun monorepo with its own `package.json`, `bun.lock`, `biome.json`
  and `.github/workflows/`. It is **not** a workspace member of this root
  (bun workspaces do not nest). Run its checks inside it: `cd template && bun
  run check`, or `bun run check` from the root.
- `template/.github/workflows/` are the downstream projects' workflows. GitHub
  never runs nested workflow files, so they are inert here. This repo's own
  automation lives in the root `.github/workflows/`.
- Conventions for the template's code are in `template/CLAUDE.md`.
