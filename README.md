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
cd my-app && git init
bun scripts/init.mjs --name my-app             # rename placeholders + commit; --dry-run to preview
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
deployment**. That backend answers the client API on `127.0.0.1:3210` and the
HTTP router — where Better Auth lives — on `127.0.0.1:3211`. A cloud deployment
gives those two one host each (`<name>.convex.cloud` and `<name>.convex.site`),
which is why the web app derives the second from the first and takes no second
build variable. Against two ports that derivation is a no-op, so a router merges
them back into one origin.

Four steps, each from the repo root. Steps 1 to 3 each hold their terminal:

```bash
# 1. the backend
cd template/packages/api && CONVEX_AGENT_MODE=anonymous bunx convex dev
```

```bash
# 2. one origin in front of its two ports, on 127.0.0.1:3200
bun scripts/local-convex-router.mjs
```

```bash
# 3. point the web app at the router, then run it
echo 'VITE_CONVEX_URL=http://127.0.0.1:3200' > template/apps/web/.env.local
cd template && bun dev
```

```bash
# 4. name the origin the browser actually uses
cd template/packages/api && bunx convex env set SITE_URL http://127.0.0.1:3000
```

The app is then on `http://127.0.0.1:3000`, and the screenshot tooling signs in
against it. `auth:login` reads `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` from
`template/apps/web/.dev.vars`; sign that account up once through the app's own
`/login` form.

```bash
cd template/apps/web
STACK_BASE_URL=http://127.0.0.1:3000 bun run auth:login
STACK_BASE_URL=http://127.0.0.1:3000 bun run screenshots
```
