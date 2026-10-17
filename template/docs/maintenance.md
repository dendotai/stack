# Maintenance

Every version pin in the project gets an update job or a reason why it has none. A version pin is any place that picks a version of something from outside the repo: an exact version, a range, a major only (`@v6`), `latest`, or copied content with no version string.

## How updates run

Renovate opens the update PRs. `.github/workflows/renovate.yml` runs it every Monday at 03:17 UTC, and **Run workflow** on the workflow's page in the Actions tab starts a run at any time. It runs as the project's own GitHub App: a PR opened with `GITHUB_TOKEN` starts no workflow, so its checks would never run. The workflow pins the Renovate version it runs (`renovate-version`), and Renovate bumps that line too.

Each update PR runs every check in `.github/workflows/test.yml` and `build.yml` on the new version, so a green PR shows the bump works. Nothing merges unattended. Renovate also keeps one issue, **Dependency Dashboard**, that lists every pending and skipped update.

`renovate.json` holds the rules:

- Every dependency stays at an exact version (`:pinAllExceptPeerDependencies`), so what runs is what the PR tested.
- Every `uses:` keeps its full commit SHA, and Renovate updates the SHA and the `# vX.Y.Z` comment together.
- Every minor and patch update arrives in one PR a week (`group:allNonMajor`), so a green PR is one merge. Each major update gets its own PR, because a major often needs a code change, and a red major in the weekly PR would hold every other update.
- Major updates of packages that must move together share one PR: `wrangler` with `@cloudflare/vite-plugin`, the TanStack router and Start packages, and `react` with `react-dom` (through the monorepo groups of `config:recommended`).
- The convex-local-backend version in `packages/api/e2e/CONVEX_LOCAL_BACKEND_VERSION` follows Convex's GitHub releases. Convex marks most releases as prereleases, and Renovate proposes only the others. Two releases on the same day count as one version, because the tag's commit hash carries no order.
- `semantic-release` runs through `bunx` and `npx`, outside `package.json`, so a rule finds `semantic-release@<version>` in the workflows and in `RELEASING.md` and bumps every line together. The `semantic-release-dry-run` job in `test.yml` runs that version with `--dry-run` on each PR, so a version that cannot load the release config fails its update PR, not the next release.

## One-time GitHub App setup

One app serves every repository of an owner (a user or an organization).

- Create the app: GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**. Name it `<owner> renovate`, turn off the webhook, and give it these repository permissions:
  - Read and write: Checks, Commit statuses, Contents, Issues, Pull requests, Workflows.
  - Read: Administration, Dependabot alerts, Metadata.
- Generate a private key on the app's page.
- Install the app on each repository that runs Renovate.
- Store the app's **Client ID** and the private key in the secret manager (the `renovate` section of `scripts/secrets.manifest.json`), then set them on the repository, not on an environment, because the Renovate job runs outside `dev` and `prod`:

```bash
gh variable set RENOVATE_CLIENT_ID --body "$(op read "op://<vault>/<project> dev/renovate/client-id")"
op read "op://<vault>/<project> dev/renovate/private-key" | gh secret set RENOVATE_PRIVATE_KEY
```

The commands use the 1Password CLI as the example; any secret manager with a CLI works the same way.

## Declining an update

Renovate keeps no record of the updates it proposed: each run proposes the newest version of every package that is behind.

- **One update in the weekly PR breaks a check:** revert that package in the PR's branch and merge the rest. The next run proposes it again, so a fixed release arrives on its own. Until one ships, add a rule to `renovate.json` that skips the broken version (`"matchPackageNames": ["<name>"], "allowedVersions": "!/^1\\.2\\.3$/"`) so the weekly PR stays green, and delete the rule once a newer release passes.
- **Closing the weekly PR declines nothing:** the next run opens it again with the same title.
- **Closing a major-update PR** skips the exact version its title names (`to 5.0.0`, not `to v5`), so the next release of that major opens a new PR, which is the retest.

## Exact pins, and the exception

Every `dependencies` and `devDependencies` entry is an exact version. A project that publishes a package to npm keeps ranges in that package's `dependencies` and `peerDependencies`, because an exact version there forces every consumer to install that exact copy. Such a project adds a rule to `renovate.json` for that package's `package.json` (`"matchFileNames": ["packages/<name>/package.json"], "rangeStrategy": "auto"`).

## Version pins with no update job

- `caddy` and `op`: installed on each machine, outside the repo.
- `gh` and `unzip`: they come with the runner image, which `runs-on: ubuntu-24.04` pins.
- The `$schema` URLs in `apps/web/components.json`, `tsconfig.base.json` and `renovate.json`: editor hints, always the newest on purpose.
- `docs/agents/` and the "Agent skills" section of `CLAUDE.md`: settings for skills installed outside the repo.
- `nodejs_compat` in `apps/web/wrangler.jsonc`: a feature flag, not a version.

## A new version pin

A change that adds a kind Renovate does not find on its own adds a rule to `renovate.json` in the same commit, or adds its reason here. A change that moves or reshapes a line a `customManagers` rule reads updates that rule in the same commit, because Renovate skips a line it cannot match and reports no error.
