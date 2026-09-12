# stack

Starter template for full-stack apps on TanStack Start + Convex + Better Auth
on Cloudflare, and the home of its future site and tooling.

```
.
├── template/             # the starter — what a new project receives
├── apps/                 # (future) marketing site — this repo's own, not the starter's
├── packages/             # (future) bootstrap CLI — same; the starter's apps/ and packages/ are under template/
├── scripts/              # this repo's own tooling (see Acceptance pass below)
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

## Acceptance pass against a local backend

The template is never deployed from this repo (see `CLAUDE.md`), so a change
that needs a running Convex backend is accepted against a **local anonymous
deployment**:

```bash
cd template/packages/api && CONVEX_AGENT_MODE=anonymous bunx convex dev
```

That backend answers the client API on `127.0.0.1:3210` and the HTTP router —
where Better Auth lives — on `127.0.0.1:3211`. A cloud deployment gives those
two one host each (`<name>.convex.cloud` and `<name>.convex.site`), which is
why the web app derives the second from the first and takes no second build
variable. Against two ports that derivation is a no-op, so put the router in
front and point the web app at it:

```bash
bun scripts/local-convex-router.mjs            # one origin on 127.0.0.1:3200
echo 'VITE_CONVEX_URL=http://127.0.0.1:3200' > template/apps/web/.env.local
bunx convex env set SITE_URL http://127.0.0.1:3000   # in template/packages/api
```

The web app then runs as usual (`bun dev` inside `template/`), and
`apps/web/scripts/` signs in and captures screenshots against it with
`STACK_BASE_URL=http://127.0.0.1:3000`.
