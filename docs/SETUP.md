# Setup

One-time provisioning to take a project created from this template to **deployed**
on two environments (`dev` and `prod`). Do the sections in order; the last one
(GitHub environments) wires everything together so CI/CD can deploy.

Each environment is a full, isolated stack: its own Cloudflare Worker + custom
domain, its own Convex deployment, its own WorkOS environment. `dev` deploys from
the `dev` branch, `prod` (a.k.a. the GitHub `production` environment) from `main`.

## Prerequisites

- **bun** ≥ 1.3.8 (`packageManager` in root `package.json`).
- **[`muxa`](https://github.com/dendotai/muxa)** — the monorepo process runner the
  root `dev` script uses (`muxa -s @stack/web dev web -s @stack/api dev convex`).
  Install it globally (`bun add -g muxa`), or replace the `dev` script with any
  parallel runner you prefer (e.g. run `bun --filter @stack/web dev` and
  `cd packages/api && bunx convex dev` in two terminals).
- **1Password CLI (`op`)** — recommended for piping secrets into GitHub without
  printing them (see [Secrets & environments](#secrets--environments)).
- Accounts: Cloudflare, Convex, WorkOS, GitHub.

---

## 1. Cloudflare account + domain

- Sign in: <https://dash.cloudflare.com/>
- Add your domain as a **zone** (Add a Site → enter the apex → Free plan).
- Update nameservers at your registrar to Cloudflare's (the dashboard shows them).
- Wait for **Active** status (usually <1h).
- Note your **Account ID** (dashboard right sidebar) → GitHub variable `CLOUDFLARE_ACCOUNT_ID`.
- Create an **API token** with:
  - Account → Workers Scripts: **Edit**
  - Account → Account Settings: **Read**
  - Zone → Workers Routes: **Edit** (your zone)
  - Zone → DNS: **Edit** (your zone)
  - (Template "Edit Cloudflare Workers" + add the DNS scope.)
  - Save the value → GitHub secret `CLOUDFLARE_API_TOKEN` (the same token works for both environments).

### Custom domains bind automatically

`wrangler deploy` **auto-binds** the custom domain declared under
`env.{dev,prod}.routes` in `apps/web/wrangler.jsonc` on every deploy (idempotent
once it exists). The domain only has to be **bindable** — Cloudflare must manage
its DNS. Subdomains (`dev.<domain>`) are usually clean; see
[gotcha #1](#prod-cutover-gotchas) for the apex.

---

## 2. Convex (two deployments)

- Sign up: <https://convex.dev/>
- Create a project. You get a **dev deployment** automatically.
- Create a **production deployment** (project Settings → Production deployment).
- Generate **deploy keys** for both (Settings → Deploy keys → New):
  - dev key → GitHub `dev` env secret `CONVEX_DEPLOY_KEY`.
  - prod key → GitHub `production` env secret `CONVEX_DEPLOY_KEY`.
  - These are **deploy-only** (least privilege) — they exist so CI can run
    `convex deploy`, nothing more.
- Note each deployment's **HTTPS URL** → GitHub variable `CONVEX_URL` (per env).
- Locally: `cd packages/api && bunx convex dev` does an interactive browser login
  and links your dev deployment (no key stored locally).

---

## 3. WorkOS (two environments)

- Sign up: <https://workos.com/>. You get a **Sandbox** environment — use it as `dev`.
- Create a **Production** environment.
- For **each** environment:
  - Enable **AuthKit** (Authentication → AuthKit → Configure).
  - Set the **Redirect URI**: `https://<your-host>/api/auth/callback`
    (dev: `https://dev.<domain>/...`, prod: `https://<domain>/...`; add
    `https://<project>.internal/...` too if you use the devsite host locally).
  - Enable the providers you want (Google + email/password).
  - Note the **Client ID** (`client_…`) and **API Key** (`sk_…`).
- `WORKOS_COOKIE_PASSWORD` — generate one per env: `openssl rand -base64 32`.
  Split per-env on purpose (a dev leak can't forge prod sessions).
- **Prod needs your own Google OAuth app** — see [gotcha #3](#prod-cutover-gotchas).

> The Convex side verifies these tokens via `auth.config.ts`, which is keyed on
> `WORKOS_CLIENT_ID`. That variable must be set **on the Convex deployment** too —
> see [gotcha #2](#prod-cutover-gotchas).

---

## 4. GitHub environments (Variables vs Secrets)

`deploy.yml` reads two kinds of config — **Variables** (non-secret, visible in
logs) and **Secrets** (masked). The names are **identical** across `dev` and
`production`; the workflow selects the right environment per branch
(`main` → `production`, otherwise `dev`). Set both kinds on **each** environment
(per-env, not repo-wide).

- Repo → Settings → Environments → create **`dev`** and **`production`**.
- On `production`, optionally enable **Required reviewers** (yourself) so prod
  deploys need a click.

**Variables** (Settings → Environments → `<env>` → Environment variables):

| Name | Value |
|---|---|
| `CONVEX_URL` | the env's Convex deployment HTTPS URL (build embeds it as `VITE_CONVEX_URL`; also bound as the worker's runtime `CONVEX_URL`) |
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account id |
| `WORKOS_REDIRECT_URI` | `https://<host>/api/auth/callback` for that env |

**Secrets** (Settings → Environments → `<env>` → Environment secrets):

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from §1 (same for both) |
| `CONVEX_DEPLOY_KEY` | the env's Convex deploy key (`gha-dev` / `gha-prod`) |
| `WORKOS_CLIENT_ID` | the env's WorkOS client id |
| `WORKOS_API_KEY` | the env's WorkOS API key |
| `WORKOS_COOKIE_PASSWORD` | the env's cookie password |

---

## 5. Local dev secrets

- `cp apps/web/.dev.vars.example apps/web/.dev.vars` and fill with your **dev**
  values (`init.mjs` does this copy for you). Powers `bun dev` locally.
- `cp apps/web/.env.local.example apps/web/.env.local` and set
  `VITE_CONVEX_URL` to your dev deployment (embedded into local builds).
- `cd packages/api && bunx convex dev` once to link the dev deployment.

---

## Secrets & environments

How secrets are organized (the approach this stack uses in production):

1. **Cross-project / shared infra secrets → a `den-ai` umbrella 1Password vault.**
   Anything not tied to a single project (e.g. a Caddy root CA shared across all
   projects).
2. **Project secrets → the project's own vault, one item per environment** —
   `<project> dev` and `<project> prod`. **Not** a single combined doc with
   env-suffixed fields.

**Rules**

- **Field labels carry no env qualifier** — the item name already encodes the
  environment. Inside `<project> dev`, `convex / deploy key` unambiguously means
  the dev key.
- **Genuinely account-level fields** (`cloudflare account-id`, `cloudflare api token`)
  are either duplicated into both env items (low-churn, the default) or pulled into
  a small `<project> shared` item for zero duplication.
- **`workos cookie-password` is split per-env on purpose** so a dev leak can't
  forge prod sessions.
- Everything else genuinely differs per env: Convex deployment/url/key, WorkOS
  client-id/api-key/redirect-uri, app site-url.

**Why split per env:** the environment is the dominant axis (most fields differ
dev↔prod). A split item maps **1:1 to what you actually fill** — the GitHub
`production` environment ← `<project> prod` — so values copy straight across with
no chance of grabbing a dev value for prod, and prod keeps its blast-radius isolation.

**Never paste secret values through the terminal/agent.** Pipe from `op`:

```bash
op read "op://<project> dev/convex/deploy key" | gh secret set CONVEX_DEPLOY_KEY --env dev
op read "op://<project> prod/workos/api key"   | gh secret set WORKOS_API_KEY    --env production
# variables are not secret:
gh variable set CONVEX_URL --env production --body "https://<prod>.convex.cloud"
```

CI deploy keys are **deploy-only** (`deployment:deploy` scope for Convex), least
privilege.

---

## Acceptance — "deployed"

- Pushing to `dev` triggers GitHub Actions, succeeds, and `https://dev.<domain>` loads.
- WorkOS sign-in works on dev (Google + email/password).
- The signed-in `/home` route renders `Hello, {name}` (the `users` upsert + authed
  read worked end-to-end).
- Pushing to `main` deploys `https://<domain>` with the same flow.

---

## Prod cutover gotchas

Lessons from bringing this stack up in production — any new project will hit these.

1. **Apex custom-domain bind fails on imported registrar parking records.**
   Cloudflare imports the registrar's existing DNS when you add the zone;
   `wrangler deploy` then can't bind the **apex** (`code 100117`) until you delete
   the imported A/CNAME parking records (e.g. Porkbun's `pixie.porkbun.com`
   CNAMEs + parking A records). Delete them, then re-deploy — Cloudflare creates
   the proxied binding + TLS automatically. Subdomains (`dev.`) are usually clean.

2. **Convex env vars are per-deployment, and `auth.config.ts` bakes them at deploy
   time.** `convex env set` defaults to the **dev** deployment — set prod
   explicitly (dashboard or targeted) and **redeploy Convex** after any change.
   `auth.config.ts` is keyed entirely on `WORKOS_CLIENT_ID`; a wrong value (e.g.
   pasting the Convex deployment id instead of the WorkOS `client_…`) →
   `NoAuthProvider`.

3. **WorkOS prod needs your own Google OAuth app.** Sandbox uses WorkOS's shared
   demo Google creds; prod requires your own Google Cloud OAuth client. The
   redirect URI you register in **Google** is **WorkOS's** callback (shown in the
   WorkOS dashboard), **not** your app's `…/api/auth/callback`. Keep scopes default
   (`openid`/`email`/`profile`) and don't return Google tokens → avoids Google's
   verification review.

4. **First login during any auth misconfig leaves no `users` row.**
   `users.getOrCreate` runs in the login callback; if it failed, the session still
   works for reads (`authedQuery` tolerates a null user) but every `authedMutation`
   throws "User not found". Fix: **log out and back in** once the config is corrected.

5. **GitHub Actions Variables vs Secrets are scoped per environment.** Identical
   names in `dev`/`production`; the job's `environment:` selects which resolve. Keep
   1Password as the source of truth and pipe `op read … | gh secret set …` so
   values never transit the terminal.
