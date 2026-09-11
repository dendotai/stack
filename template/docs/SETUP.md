# Setup

One-time provisioning to take a project created from this template to **deployed**
on two environments (`dev` and `prod`). Do the sections in order; the last one
(GitHub environments) wires everything together so CI/CD can deploy.

Each environment is a full, isolated stack: its own Cloudflare Worker + custom
domain, its own Convex deployment. `dev` deploys from
the `dev` branch, `prod` (a.k.a. the GitHub `production` environment) from `main`.

## Prerequisites

- **bun** ≥ 1.3.8 (`packageManager` in root `package.json`).
- **A monorepo process runner** for the root `dev` script, which uses `muxa`
  (`muxa -s @stack/web dev web -s @stack/api dev convex`) to run web + Convex
  with labeled output. If you don't have `muxa`, replace the `dev` script with
  any parallel runner — or just run the two in separate terminals:
  `bun --filter @stack/web dev` and `cd packages/api && bunx convex dev`.
- **A password manager with a CLI** for piping secrets into GitHub without
  printing them (examples below use the 1Password CLI `op`; see
  [Secrets & environments](#secrets--environments)).
- Accounts: Cloudflare, Convex, GitHub.

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
  - Zone → Single Redirect: **Edit** (your zone) — for the local-callback hop in
    [§3](#local-google-callbacks-the-cloudflare-redirect-hop). The dashboard picker calls it
    "Single Redirect"; the docs call the product "Dynamic URL Redirect".
  - (Template "Edit Cloudflare Workers" + add the DNS and Single Redirect scopes.)
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

### Deployment env vars

Better Auth runs inside the Convex deployment ([ADR 0004](adr/0004-identity-plane-better-auth-in-convex.md)),
so its config is **per Convex deployment**, not a Worker secret. Set these on
**each** deployment before the first push — a push missing `BETTER_AUTH_SECRET`
or `SITE_URL` fails outright, by design.

| Variable | Value | Why |
|---|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`, one per deployment | signs Better Auth sessions; split per env so a dev leak can't forge prod sessions |
| `SITE_URL` | the web app's **deployed** origin for that env (dev: `https://dev.<domain>`, prod: `https://<domain>`) | Better Auth's `baseURL`. Exactly one origin; a second front goes in `AUTH_TRUSTED_ORIGINS` below |
| `AUTH_DISABLE_SIGNUP` | `true` to close a deployment; unset while bootstrapping | refuses **new** email/password registrations and hides the form's create-account control; existing users keep signing in |
| `GOOGLE_CLIENT_ID` | that environment's own OAuth client id ([§3](#3-google-sign-in)) | Google sign-in; required, so a push without it fails |
| `GOOGLE_CLIENT_SECRET` | that environment's own OAuth client secret | as above |
| `AUTH_TRUSTED_ORIGINS` | **dev only:** the local devsite origin, e.g. `https://<project>.internal`. Comma-separated for more than one. Prod lists none. | a front other than `SITE_URL` fails the CSRF origin check unless it is listed here |
| `GOOGLE_REDIRECT_URI` | **dev only:** `https://internal.<domain>/api/auth/callback/google` ([§3](#local-google-callbacks-the-cloudflare-redirect-hop)) | the redirect a trusted front other than `SITE_URL` sends to Google; Google refuses a `.internal` URI, so the local front borrows the public hop host |

```bash
cd packages/api
bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set SITE_URL https://dev.<domain>
bunx convex env set AUTH_TRUSTED_ORIGINS https://<project>.internal
bunx convex env set GOOGLE_REDIRECT_URI https://internal.<domain>/api/auth/callback/google
# …and again with --prod using the prod values, minus the two dev-only rows.
```

**Both dev fronts run against the one dev deployment.** `SITE_URL` is the
deployed dev host; the local devsite host reaches the same deployment through
`AUTH_TRUSTED_ORIGINS`. Each sign-in returns to the front that started it: the
deployment picks the Google redirect per request from the forwarded front host,
and Better Auth's post-callback redirect is a path, which the browser resolves
against whichever front it is on.

---

## 3. Google sign-in

Google's consent screen names the OAuth client's project, so the project is the
product's own — not a shared one, and not the hosting vendor's.

**One Google Cloud project per product**, on the product owner's Google account:
<https://console.cloud.google.com/> → new project, named after the product.

**Consent screen** (APIs & Services → OAuth consent screen):

- User type **External**, and **Publish** it. In testing mode only listed test
  users can sign in, and their sessions expire in days.
- **Default scopes only** (`email`, `profile`, `openid`). Anything else is a
  sensitive or restricted scope and triggers Google's verification review.
- **No logo.** Uploading one also triggers the review, for no functional gain.

**One OAuth client per environment** (APIs & Services → Credentials → Create
credentials → OAuth client ID → Web application). Two clients, so a leaked dev
credential cannot reach prod sign-in.

| Client | Authorized redirect URIs |
|---|---|
| `<product> dev` | `https://dev.<domain>/api/auth/callback/google` and `https://internal.<domain>/api/auth/callback/google` (the hop, below) |
| `<product> prod` | `https://<domain>/api/auth/callback/google` |

Each client's id and secret go to **that environment's Convex deployment** as
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ([§2](#deployment-env-vars)), and to
that environment's 1Password item under a `google`
section ([Secrets & environments](#secrets--environments)).

Registering several redirect URIs on one client is harmless. Which one is live
is deployment config, not Google config.

### Local Google callbacks: the Cloudflare redirect hop

Google refuses a redirect URI on a non-public TLD, so the local devsite host
(`https://<project>.internal`) cannot be registered. It does not have to be:
Google never *contacts* the redirect URI, it only hands the browser a 302. So
register a public hostname and have Cloudflare bounce the browser inward.

1. **DNS** (your zone → DNS → Records): a **proxied** dummy record
   `internal.<domain>`, type `AAAA`, value `100::`. Universal SSL covers
   first-level subdomains, so it gets a certificate with no extra work. Put its
   purpose in the record's **Comment** field: "OAuth redirect hop to the local
   devsite (SETUP.md §3)".
2. **Redirect rule** (your zone → Rules → Redirect Rules → Single Redirect):
   - When `http.host eq "internal.<domain>"`
   - Then a **dynamic** 302 to
     `concat("https://<project>.internal", http.request.uri.path)`
   - **Preserve query string: on** — the authorization code arrives in it.
   - Name the rule for what it does: "OAuth redirect hop → local devsite".
   The rule matches any path, so the hostname also serves anything else that
   ever needs a public URL landing on local dev.
3. **Token scope**: managing the rule from the API needs
   Zone → Single Redirect: **Edit** ([§1](#1-cloudflare-account--domain)).

The dev deployment then sends `https://internal.<domain>/api/auth/callback/google`
to Google as the redirect for the local front (`GOOGLE_REDIRECT_URI`), and
Cloudflare returns the browser to `https://<project>.internal/api/auth/callback/google`
with the code intact.

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

**Secrets** (Settings → Environments → `<env>` → Environment secrets):

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from §1 (same for both) |
| `CONVEX_DEPLOY_KEY` | the env's Convex deploy key (`gha-dev` / `gha-prod`) |

The worker gets no auth secrets: Better Auth runs inside the Convex deployment
and reads its own variables there ([§2](#deployment-env-vars)).

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

1. **Cross-project / shared infra secrets → a single umbrella vault** (one
   password manager vault you keep across projects). Anything not tied to one
   project — e.g. an account-level API credential reused everywhere.
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
- **`convex / auth-secret` (the deployment's `BETTER_AUTH_SECRET`) is split
  per-env on purpose** so a dev leak can't forge prod sessions.
- **A `google` section in each env item holds `client-id` and `client-secret`**
  — that environment's own OAuth client ([§3](#3-google-sign-in)). Two clients,
  two pairs of values, one pair per item; nothing is shared between them.
- Everything else genuinely differs per env: Convex deployment/url/key, app
  site-url.

**Why split per env:** the environment is the dominant axis (most fields differ
dev↔prod). A split item maps **1:1 to what you actually fill** — the GitHub
`production` environment ← `<project> prod` — so values copy straight across with
no chance of grabbing a dev value for prod, and prod keeps its blast-radius isolation.

**Never paste secret values through the terminal/agent.** Pipe from `op`:

```bash
op read "op://<project> dev/convex/deploy key" | gh secret set CONVEX_DEPLOY_KEY --env dev
# Convex deployment variables go to the deployment, not to GitHub:
op read "op://<project> prod/convex/auth-secret" | xargs bunx convex env set --prod BETTER_AUTH_SECRET
# variables are not secret:
gh variable set CONVEX_URL --env production --body "https://<prod>.convex.cloud"
```

CI deploy keys are **deploy-only** (`deployment:deploy` scope for Convex), least
privilege.

---

## Acceptance — "deployed"

- Pushing to `dev` triggers GitHub Actions, succeeds, and `https://dev.<domain>` loads.
- Sign-up and sign-in with email and password work on `https://dev.<domain>`,
  on the app's own login page — the browser never leaves the domain.
- The signed-in `/home` route renders `Hello, {name}` (the `users` trigger + authed
  read worked end-to-end).
- **Sign out** ends the session and returns to the landing page.
- The landing page loads for an anonymous visitor with no request to the auth
  path.
- **Continue with Google** works on both dev fronts — `https://dev.<domain>` and
  the local `https://<project>.internal` — and each returns to the front it
  started on. Google's consent screen names the product.
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

2. **Convex env vars are per-deployment, and the auth setup reads them at push
   time.** `convex env set` defaults to the **dev** deployment — set prod
   explicitly (`--prod` or the dashboard) and **redeploy Convex** after any
   change. `BETTER_AUTH_SECRET`, `SITE_URL`, `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` are per-deployment; a push missing any of them fails
   outright. Full list: [§2](#deployment-env-vars).

3. **A second front needs `AUTH_TRUSTED_ORIGINS`, not a second `SITE_URL`.**
   `SITE_URL` is one origin, and Better Auth rejects any other front's `Origin`
   header unless it is listed in `AUTH_TRUSTED_ORIGINS`. Dev has two fronts —
   the deployed dev host and the local devsite host — so the deployed one is
   `SITE_URL` and the local one is the trusted origin. Prod has one front and
   lists none.

4. **Prod's Google client is a promotion-time step, not a day-one one.** Create
   the prod OAuth client, set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on the
   prod deployment, and register `https://<domain>/api/auth/callback/google` as
   its redirect URI **before the first `main` deploy** — the push fails without
   the two variables. Nothing else about prod Google setup can be done earlier:
   the redirect URI names the prod host. The hop from
   [§3](#local-google-callbacks-the-cloudflare-redirect-hop) is dev-only; prod
   registers one redirect URI and needs no `GOOGLE_REDIRECT_URI`.

5. **GitHub Actions Variables vs Secrets are scoped per environment.** Identical
   names in `dev`/`production`; the job's `environment:` selects which resolve. Keep
   1Password as the source of truth and pipe `op read … | gh secret set …` so
   values never transit the terminal.
