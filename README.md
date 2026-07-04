# stack

A minimal, **production-verified** starter for full-stack apps on this stack:

- **Monorepo** — [bun](https://bun.sh) workspaces (`apps/*`, `packages/*`), [Biome](https://biomejs.dev) for lint/format.
- **Web** (`apps/web`) — [TanStack Start](https://tanstack.com/start) on **Cloudflare Workers** ([`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)), Tailwind v4 + shadcn/ui, reads via [`@convex-dev/react-query`](https://github.com/get-convex/convex-react-query).
- **Backend** (`packages/api`) — [Convex](https://convex.dev) (dev + prod deployments).
- **Auth** — [WorkOS AuthKit](https://workos.com/docs/authkit) hosted login (`@workos/authkit-tanstack-react-start`).
- **CI/CD** — GitHub Actions: PR checks + push-to-deploy (`dev` → dev env, `main` → prod).
- **Mobile** — `apps/mobile/` is a README-only placeholder for a future Expo app.

This is a **runnable app**, not a `{{mustache}}` skeleton: `/` landing, WorkOS
sign-in, and a placeholder signed-in `/home` route that reads the current user
(`Hello, {name}`) — demonstrating the authed read path end-to-end. Build your app
by replacing `/home`.

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
│   ├── SETUP.md          # external setup: Cloudflare, Convex, WorkOS, GitHub, secrets
│   └── adr/              # architecture decision records
├── .github/workflows/    # ci.yml (checks) + deploy.yml (push-to-deploy)
├── VERSION               # template version this tree is at
└── TEMPLATE_CHANGELOG.md # what changed between template versions
```

## Creating a project from this template

1. On GitHub, click **Use this template** → create your repo (or clone
   `dendotai/stack` and re-point `origin`).
2. Rename the placeholders. The init script takes named flags; the only required
   one is `--name`, given as the domain with dots→dashes (the repo-naming
   convention, e.g. `muxa-io`, `targetlocked-com`). Everything else is derived
   from it:

   ```bash
   bun scripts/init.mjs --name targetlocked-com
   #  → @targetlocked-com scope, targetlocked.com / dev.targetlocked.com domains,
   #    targetlocked-com.internal dev host, targetlocked-com{,-dev,-prod} worker names

   bun scripts/init.mjs --name targetlocked-com --dry-run   # preview, write nothing
   ```

   `--name` is the single token that flows everywhere (repo/package/scope/worker
   names). Override any derived value with its own flag — e.g. `--scope
   targetlocked` for a shorter `@targetlocked/api`, or `--domain`/`--dev-domain`/
   `--host`. The script rewrites the distinctive tokens and
   copies the `*.example` env files into place. It leaves display strings (the
   landing `<h1>`, the page `<title>`, this README) — `grep -rn '\bstack\b'` and
   edit by taste.

   > Prefer to do it by hand? The full flag list + token mapping is documented at
   > the top of `scripts/init.mjs`.

3. `bun install`.
4. Provision the external services and wire secrets — follow **[docs/SETUP.md](docs/SETUP.md)**.
5. Fill the `.dev.vars` / `.env.local` files the script created, then
   `cd packages/api && bunx convex dev` once to link your dev deployment.

## Develop

```bash
bun run dev        # web (:3000) + convex, in parallel — needs the `muxa` runner (see SETUP)
bun run check      # lint + typecheck + test (mirrors CI)
bun run build      # build every workspace
```

Each workspace's scripts are documented in its own README / `package.json`.

## Deploy

Push to `dev` → deploys to the dev environment; push to `main` → prod. The
pipeline (`.github/workflows/deploy.yml`) deploys Convex first, then builds and
deploys the Worker, reading per-environment GitHub **Variables** and **Secrets**.
See [docs/SETUP.md](docs/SETUP.md) for the one-time provisioning.

## Updating a project from the template

The template evolves; pull its improvements without a hard fork:

1. Check your project's current template version in [`VERSION`](VERSION).
2. Read [`TEMPLATE_CHANGELOG.md`](TEMPLATE_CHANGELOG.md) in the **latest** template
   for every entry **newer** than that version. Each entry says what changed and,
   when it isn't a clean file copy, how to apply it.
3. Apply those changes to your project (this is designed to be agent-driven —
   point your agent at the two changelogs and the template repo).
4. Bump your project's `VERSION` to the version you applied up to.

Because the template stays a real, runnable app, you can also just diff specific
files against `dendotai/stack` when you want a single improvement.
