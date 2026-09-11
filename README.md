# stack

Starter template for full-stack apps on TanStack Start + Convex + Better Auth
on Cloudflare, and the home of its future site and tooling.

```
.
├── template/             # the starter — what a new project receives
├── apps/                 # (future) marketing site — this repo's own, not the starter's
├── packages/             # (future) bootstrap CLI — same; the starter's apps/ and packages/ are under template/
└── .github/workflows/    # this repo's own CI (runs the template's checks)
```

`template/` is a complete, runnable bun monorepo with its own lockfile and
workflows. See [`template/README.md`](template/README.md) for what is in it and
how to develop, deploy and update a project.

## Start a project

There is no "Use this template" button: it would copy this whole repo, not the
starter. Until the bootstrap CLI exists, copy the directory out yourself, or ask
an agent to:

```bash
bunx giget gh:dendotai/stack/template my-app   # copies template/ into ./my-app
cd my-app
bun scripts/init.mjs --name my-app             # rename placeholders; --dry-run to preview
```

Then follow [`template/README.md` → Setup](template/README.md#setup).

## Develop the template

```bash
bun run check        # lint + typecheck + test inside template/ (mirrors CI)
```

The template is versioned: [`template/VERSION`](template/VERSION) and
[`template/TEMPLATE_CHANGELOG.md`](template/TEMPLATE_CHANGELOG.md).
