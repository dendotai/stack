# stack

A minimal, **production-verified** starter for full-stack apps on this stack:

- **Monorepo** — [bun](https://bun.sh) workspaces (`apps/*`, `packages/*`), [Biome](https://biomejs.dev) for lint/format.
- **Web** (`apps/web`) — [TanStack Start](https://tanstack.com/start) on **Cloudflare Workers** ([`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)), Tailwind v4 + shadcn/ui, reads via [`@convex-dev/react-query`](https://github.com/get-convex/convex-react-query).
- **Backend** (`packages/api`) — [Convex](https://convex.dev) (dev + prod deployments).
- **Auth** — first-party login: [Better Auth](https://better-auth.com) inside the Convex deployment ([`@convex-dev/better-auth`](https://github.com/get-convex/better-auth)), the app's own form and its own domain, Google on the project's own OAuth client per environment ([ADR 0004](docs/adr/0004-identity-plane-better-auth-in-convex.md)).
- **CI/CD** — GitHub Actions: PR checks + push-to-deploy (`dev` → dev env, `main` → prod); each prod deploy gets a release version from the commit prefixes ([RELEASING.md](RELEASING.md)).
- **Mobile** — `apps/mobile/` is a README-only placeholder for a future Expo app.

This is a **runnable app**, not a `{{mustache}}` skeleton: `/` landing, a sign-in form served by the app itself (email and password, or Google), and a placeholder signed-in `/home` route that reads the current user (`Hello, {name}`) — demonstrating the authed read path end-to-end. Build your app by replacing `/home`.

The template is **versioned** (see [`VERSION`](VERSION) + [`TEMPLATE_CHANGELOG.md`](TEMPLATE_CHANGELOG.md)) so improvements can flow from the template into projects created from it.

## Layout

```
.
├── apps/
│   ├── web/              # TanStack Start + Cloudflare Workers
│   └── mobile/           # placeholder for Expo (README only)
├── packages/
│   └── api/              # Convex schema + functions + generated client (@stack/api)
├── docs/
│   ├── SETUP.md          # external setup: Cloudflare, Convex, GitHub, secrets
│   ├── adr/              # architecture decision records
│   └── agents/           # config the agent skills read: issue tracker, labels, domain docs
├── .github/workflows/    # test.yml + build.yml (checks), deploy.yml (release + push-to-deploy)
├── CONTEXT.md            # glossary: the terms code, issues and docs use
├── RELEASING.md          # the release flow: release PR, version from commit prefixes
├── VERSION               # template version this tree is at
└── TEMPLATE_CHANGELOG.md # what changed between template versions
```

## Setup

This tree was copied out of [`dendotai/stack`](https://github.com/dendotai/stack) (`template/` there) and renamed by `scripts/init.mjs`. If the placeholders are still in place, run the script first: `bun scripts/init.mjs --name acme-com` (`--dry-run` previews; the full flag list + token mapping is at the top of the script). `--name` is the domain with dots→dashes and is the single token that flows into repo/package/scope/worker names; override any derived value with its own flag (`--scope`, `--domain`, `--dev-domain`, `--host`). The script commits the rewritten files as `Initialize from template: <name>` (`--no-commit` to skip; run it inside a git repository, `git init` first on a fresh copy) — an uncommitted rewrite is one `git reset --hard` away from a half-renamed repo that only fails at deploy. It then leaves `main` and `dev` at that commit, with `dev` checked out: the two branches the deploy pipeline reads, aligned from the start. The script leaves display strings (the landing `<h1>`, the page `<title>`, this README) — `grep -rn '\bstack\b'` and edit by taste.

`bun scripts/init.mjs --check` fails when any placeholder is still in the tree. No workflow runs it: run it by hand after `init.mjs` and after each template update (see [Updating a project from the template](#updating-a-project-from-the-template)).

`bun scripts/secrets-scaffold.mjs` creates the per-environment secret-manager items (`<project> dev`, `<project> prod`) from `scripts/secrets.manifest.json` with the 1Password CLI; `--print` prints the same shape as a checklist for any other manager, `--dry-run` shows the plan. Every run also prints the name to create each credential under in its dashboard (`<project> gha deploy`, `gha-dev`). The layout, the naming rule and the pipe commands that read from the items are in [docs/SETUP.md](docs/SETUP.md#secrets--environments).

1. `bun install`.
2. `bun scripts/secrets-scaffold.mjs` — the per-environment secret-manager items.
3. Create the GitHub repository, pushing `dev` first so it becomes the default branch, then provision the external services and wire secrets — follow **[docs/SETUP.md](docs/SETUP.md)**.
4. Fill the `.dev.vars` / `.env.local` files the init script created, then `cd packages/api && bunx convex dev` once to link your dev deployment.

## Develop

```bash
bun run dev        # web + convex, in parallel — needs the `muxa` runner (see SETUP)
bun run devsite    # once per machine: Caddy route for https://stack.internal (see SETUP)
PORT=3012 bun dev  # web on http://localhost:3012 instead — a second checkout (an agent worktree)
bun run check      # lint + typecheck + test + patches (mirrors CI)
bun run lint       # biome, then every workspace's own lint script (e.g. an Expo app's `expo lint`)
bun run test       # every workspace's tests, then the scripts' own (scripts/)
bun run e2e        # offline e2e: a local Convex backend and the built Worker; not part of check (downloads a 150 MB binary once)
bun --filter @stack/web e2e   # one workspace's e2e only (@stack/api: the backend tests, @stack/web: the Worker tests)
bun run build      # build every workspace
```

Each workspace's scripts are documented in its own README / `package.json`.

The web dev server has no fixed port. The [`@den-ai/devsite`](https://www.npmjs.com/package/@den-ai/devsite) Vite plugin binds a free port and registers `https://stack.internal` with the local Caddy (`package.json#devSite.host` in `apps/web`), so any number of projects run at once. `PORT=3012 bun run dev` is the exception for a second checkout of this project (an agent worktree): Vite then serves plain `http://localhost:3012` and the plugin stays off, so the checkout does not take the host's route from the main checkout. The checkout's `apps/web/.env.local` can hold `PORT` instead (see `.env.local.example`); the process environment wins over the file.

`apps/web/src/routeTree.gen.ts` is generated, not committed: a fresh clone has no copy until something builds it. `bun run generate` in `apps/web` does that (`tsr generate`, configured by `apps/web/tsr.config.json`), and `typecheck`, `test` and `build` each run it first, so the three commands above need no extra step.

`@biomejs/biome` is pinned exactly: `biome.json` declares the schema of that version, and a newer CLI reports a mismatch. When you bump the pin, run `bunx biome migrate --write` in the same commit.

## Patched dependencies

A dependency changed with `bun patch` gets one line here, in the commit that adds the patch: the package and version, what the patch fixes, the upstream issue, and when to delete the patch. `package.json` holds only the `patchedDependencies` key and the patch file path, because JSON takes no comments.

- `@convex-dev/better-auth@0.12.5`: removes `BetterAuthClientPlugin` from the `PluginsWithCrossDomain` and `PluginsWithoutCrossDomain` types in `dist/react/index.d.ts`, so a `createAuthClient` result type-checks as the `authClient` of `ConvexBetterAuthProvider` with no cast at the call site. Upstream: [get-convex/better-auth#420](https://github.com/get-convex/better-auth/issues/420). Delete it when that issue closes.

`bun install` skips a patch without a warning once a version bump moves the package off the version in its key ([oven-sh/bun#40106](https://github.com/oven-sh/bun/issues/40106)). `bun scripts/check-patches.mjs` catches that case in three places: the `postinstall` script runs it with `--warn` after every `bun install`, `bun add`, `bun update` and `bun patch`, and prints the message without failing the install; `bun run check` and the `patches` job in the `test` workflow run it without the flag and fail. When it reports a patch:

- Read the upstream issue. When the new version has the fix, delete the patch file in `patches/`, its `patchedDependencies` key, and its line here.
- Otherwise make the patch again on the new version. bun applies a patch file by line number and checks nothing around it, so the old file under a new name would change whatever the new version holds on those lines; `git apply` checks every line.

  ```bash
  bun patch <name>@<new version>
  GIT_CEILING_DIRECTORIES="$PWD/node_modules" git -C node_modules/<name> apply -p1 "$PWD/<old patch file>"
  bun patch --commit node_modules/<name>
  ```

  The ceiling keeps `git` from finding the project's repo, where `git apply` skips the file and still exits 0. When `git apply` fails, upstream changed that code: make the change by hand in `node_modules/<name>` before the commit step. bun adds a new key and a new patch file and keeps the old ones: delete the old patch file and its key, and update the version in the line here.

## Deploy

Push to `dev` → deploys to the dev environment; push to `main` → prod. The pipeline (`.github/workflows/deploy.yml`) deploys Convex first, then builds and deploys the Worker, reading per-environment GitHub **Variables** and **Secrets**. See [docs/SETUP.md](docs/SETUP.md) for the one-time provisioning.

## Updating a project from the template

The template evolves; pull its improvements without a hard fork:

1. Check your project's current template version in [`VERSION`](VERSION).
2. Read [`TEMPLATE_CHANGELOG.md`](TEMPLATE_CHANGELOG.md) in the **latest** template for every released entry **newer** than that version, then read every file in [`.changelog/`](https://github.com/dendotai/stack/tree/dev/.changelog) at the root of `dendotai/stack` — those are the entries no release has folded in yet. Each entry says what changed and, when it isn't a clean file copy, how to apply it.
3. Apply those changes to your project (this is designed to be agent-driven — point your agent at the two changelogs and the template repo). When an entry adds something your project already does its own way, keep one version, yours or the template's with your data moved over, because two copies of one mechanism drift apart.
4. Run `bun scripts/init.mjs --check`: a copied file can bring a template placeholder back, and it would otherwise surface only as a wrong-zone deploy error.
5. Bump your project's `VERSION` to the version you applied up to.

Because the template stays a real, runnable app, you can also just diff specific files against `template/` in `dendotai/stack` when you want a single improvement.
