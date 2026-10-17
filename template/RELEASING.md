# Releasing

A release is a `dev` → `main` pull request. Its merge deploys prod, and the deploy computes the release version from the commit messages.

## The flow

- Feature pull requests merge into `dev`. The `commitlint` job in `.github/workflows/test.yml` checks that each of their commits has a conventional prefix (`feat:`, `fix:`, `chore:`, …).
- To release, open a pull request from `dev` into `main` titled `Release TBD`, with a `## What's Changed` list of the commits it brings.
- Merge it with a **merge commit**. A squash merge turns the pull request title into the one commit semantic-release reads, and `Release TBD` carries no prefix.
- The push to `main` runs `.github/workflows/deploy.yml`. Its `Release` step runs semantic-release before the deploy steps: it reads the commits since the last tag, pushes the new tag (`v1.4.2`) and writes the GitHub release with its notes.
- The `Rename the merged release PR` step renames the merged pull request to `Release v1.4.2`.

`package.json` stays at `0.0.0`: the release version lives in git tags and GitHub releases, so no release commit lands on `main`.

## Which prefix raises which part

| Commits since the last tag                              | Release                        |
| ------------------------------------------------------- | ------------------------------ |
| a `fix:`                                                | `v1.4.1` → `v1.4.2`            |
| a `feat:`                                               | `v1.4.2` → `v1.5.0`            |
| a `!` after the type, or `BREAKING CHANGE:` in the body | `v1.5.0` → `v2.0.0`            |
| only `chore:`, `docs:`, `test:`, `refactor:`, …         | no release; prod still deploys |

A push that releases nothing keeps the last tag as the release version, and the commit hash next to it names the exact build.

## Where the version goes

The deploy passes the release version and the short commit hash to the web build as `VITE_WEB_VERSION` and `VITE_WEB_COMMIT`. A `dev` deploy passes `dev` as the version; a local build gets neither variable. Another app under `apps/` takes the same pair under its own folder name, behind its framework's prefix: `EXPO_PUBLIC_MOBILE_VERSION` and `EXPO_PUBLIC_MOBILE_COMMIT` for `apps/mobile`.

## Publishing an npm package

A project that publishes a package to npm adds the npm plugin and lets semantic-release publish it, in a workflow on push to `main`:

- Add `"@semantic-release/npm"` to the `release.plugins` list in `package.json`, before `@semantic-release/github`.
- Publish with trusted publishing (OIDC) from npmjs.com: the workflow needs `id-token: write` and `setup-node` with `registry-url: https://registry.npmjs.org`. No token exists anywhere, and npm adds provenance on its own.
- Run `npx semantic-release@25.0.9` with Node 24 on the path: `@semantic-release/npm` calls `npm publish`, and only npm 11.5.1 or later publishes through OIDC.
- Build once before semantic-release runs, so the files a `bin` entry names exist when npm first reads the manifest. A `prepack` script builds the shipped files again after semantic-release writes the version.
- Write `bin` paths without a leading `./`.
