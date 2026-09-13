# stack

A minimal, **production-verified** starter for full-stack apps on this stack:

- **Monorepo** — [bun](https://bun.sh) workspaces (`apps/*`, `packages/*`), [Biome](https://biomejs.dev) for lint/format.
- **Web** (`apps/web`) — [TanStack Start](https://tanstack.com/start) on **Cloudflare Workers** ([`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)), Tailwind v4 + shadcn/ui, reads via [`@convex-dev/react-query`](https://github.com/get-convex/convex-react-query).
- **Backend** (`packages/api`) — [Convex](https://convex.dev) (dev + prod deployments).
- **Auth** — first-party login: [Better Auth](https://better-auth.com) inside the Convex deployment ([`@convex-dev/better-auth`](https://github.com/get-convex/better-auth)), the app's own form and its own domain, Google on the project's own OAuth client per environment ([ADR 0004](docs/adr/0004-identity-plane-better-auth-in-convex.md)).
- **CI/CD** — GitHub Actions: PR checks + push-to-deploy (`dev` → dev env, `main` → prod).
- **Mobile** — `apps/mobile/` is a README-only placeholder for a future Expo app.

This is a **runnable app**, not a `{{mustache}}` skeleton: `/` landing, a
sign-in form served by the app itself (email and password, or Google), and a
placeholder signed-in `/home` route that reads the current user (`Hello, {name}`) —
demonstrating the authed read path end-to-end. Build your app by replacing
`/home`.

The template is **versioned** (see [`VERSION`](VERSION) +
[`TEMPLATE_CHANGELOG.md`](TEMPLATE_CHANGELOG.md)) so improvements can flow from the
template into projects created from it.

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
│   └── adr/              # architecture decision records
├── .github/workflows/    # ci.yml (checks) + deploy.yml (push-to-deploy)
├── VERSION               # template version this tree is at
└── TEMPLATE_CHANGELOG.md # what changed between template versions
```

## Setup

This tree was copied out of [`dendotai/stack`](https://github.com/dendotai/stack)
(`template/` there) and renamed by `scripts/init.mjs`. If the placeholders are
still in place, run the script first: `bun scripts/init.mjs --name acme-com`
(`--dry-run` previews; the full flag list + token mapping is at the top of
the script). `--name` is the domain with dots→dashes and is the single token
that flows into repo/package/scope/worker names; override any derived value
with its own flag (`--scope`, `--domain`, `--dev-domain`, `--host`). The
script commits the rewritten files as `Initialize from template: <name>`
(`--no-commit` to skip; run it inside a git repository, `git init` first on a
fresh copy) — an uncommitted rewrite is one `git reset --hard` away from a
half-renamed repo that only fails at deploy. The
script leaves display strings (the landing `<h1>`, the page `<title>`, this
README) — `grep -rn '\bstack\b'` and edit by taste.

`bun scripts/init.mjs --check` fails when any placeholder is still in the
tree; CI (`.github/workflows/ci.yml`) runs it on every push and pull request.

1. `bun install`.
2. Provision the external services and wire secrets — follow **[docs/SETUP.md](docs/SETUP.md)**.
3. Put your Convex team and project slugs into `packages/api/package.json`
   (`convex.team`, `convex.project`), then `bun run worktree:setup` links your
   dev deployment and writes its lines into the env files the init script
   created. Fill the rest of `.dev.vars` / `.env.local` by hand.

## Develop

```bash
bun run dev        # web (:3000) + convex, in parallel — needs the `muxa` runner (see SETUP)
PORT=3012 bun dev  # web on http://localhost:3012 instead, localhost only, no devsite host —
                   # for a second checkout (an agent worktree); apps/web/.env.local can hold it
bun run check      # lint + typecheck + test (mirrors CI)
bun run lint       # biome, then every workspace's own lint script (e.g. an Expo app's `expo lint`)
bun run test       # every workspace's tests, then the init script's (scripts/)
bun run build      # build every workspace
bun run worktree:setup  # this checkout's own Convex dev deployment + env files (see Worktrees)
```

Each workspace's scripts are documented in its own README / `package.json`.

`apps/web/src/routeTree.gen.ts` is generated, not committed: a fresh clone has
no copy until something builds it. `bun run generate` in `apps/web` does that
(`tsr generate`, configured by `apps/web/tsr.config.json`), and `typecheck`,
`test` and `build` each run it first, so the three commands above need no extra
step.

`@biomejs/biome` is pinned exactly: `biome.json` declares the schema of that
version, and a newer CLI reports a mismatch. When you bump the pin, run
`bunx biome migrate --write` in the same commit.

## Worktrees

`bun run worktree:setup` gives the current checkout a Convex dev deployment of
its own and writes the env files that point at it, so several checkouts of the
project — one agent session per git worktree, say — run side by side without
sharing a deployment or a port. It reads the Convex team and project slugs from
`packages/api/package.json` (`convex.team`, `convex.project`); the Convex CLI's
own login on the machine is the credential, and nothing is stored.

In a **git worktree** the deployment is `<team>:<project>:dev/agent/<name>`
(`<name>` is the worktree directory's name) and expires after 14 days. The
script sets what the first push needs and nothing more — a generated
`BETTER_AUTH_SECRET`, `SITE_URL` of the worktree's own localhost origin, and
placeholder Google client values, so Google sign-in does not work there — and
pushes once. `apps/web/.env.local` gets `PORT` (a free port in 3001–3099; 3000
is the main checkout's — see Develop) and `VITE_CONVEX_URL`; `apps/web/.dev.vars`
gets `CONVEX_URL`. In the **main checkout** it links your personal dev
deployment instead, with no expiration and no `PORT`, and sets only the values
that deployment lacks.

A rerun keeps a deployment that still exists and only refreshes the files;
when the deployment is gone — expired, or deleted — it creates a new one.

## Deploy

Push to `dev` → deploys to the dev environment; push to `main` → prod. The
pipeline (`.github/workflows/deploy.yml`) deploys Convex first, then builds and
deploys the Worker, reading per-environment GitHub **Variables** and **Secrets**.
See [docs/SETUP.md](docs/SETUP.md) for the one-time provisioning.

## Updating a project from the template

The template evolves; pull its improvements without a hard fork:

1. Check your project's current template version in [`VERSION`](VERSION).
2. Read [`TEMPLATE_CHANGELOG.md`](TEMPLATE_CHANGELOG.md) in the **latest** template
   for every released entry **newer** than that version, then read every file in
   [`.changelog/`](https://github.com/dendotai/stack/tree/dev/.changelog) at the root
   of `dendotai/stack` — those are the entries no release has folded in yet. Each
   entry says what changed and, when it isn't a clean file copy, how to apply it.
3. Apply those changes to your project (this is designed to be agent-driven —
   point your agent at the two changelogs and the template repo).
4. Bump your project's `VERSION` to the version you applied up to.

Because the template stays a real, runnable app, you can also just diff specific
files against `template/` in `dendotai/stack` when you want a single improvement.
