# 0009. The e2e harness runs the convex-local-backend binary directly

**Status:** Accepted

## Context

The unit tests run on `convex-test`, which cannot load the Better Auth component, so nothing checked sign-up, sessions, the `/api/auth/*` routes, or the Worker's auth proxy. The template has no cloud Convex deployment, and an e2e run must work offline in CI, so the harness needs a real Convex backend on the machine.

The Convex CLI looks like the natural way: `convex dev` can create a local deployment and download the backend itself. It fails the harness twice. It keeps the deployment's data in one fixed folder, so a run cannot start from an empty database. And `convex dev --once` stops the backend when the command exits, while the tests need the backend running after the deploy.

## Decision

`packages/api/e2e/local-backend.ts` downloads the `convex-local-backend` binary from Convex's GitHub releases, at the version in `packages/api/e2e/CONVEX_LOCAL_BACKEND_VERSION`, and caches it in `packages/api/e2e/.cache/`. Each start creates its own admin key with the binary's `keygen admin-key`, picks free ports, and uses a new temporary data folder. `packages/api/e2e/deployment.ts` deploys to it with `convex deploy --url --admin-key`, the self-hosting path.

## Consequences

- **Positive:** every test file gets an empty backend, runs need no network after the first download, and CI needs no Convex credentials.
- **Accepted trade-off:** about 150 lines repeat the download and start-up the CLI already does, and they follow the binary's flags. The pinned version means a flag change reaches the harness only through an update PR that runs e2e.
- **Open:** the scheduled update of the pinned version is https://github.com/dendotai/stack/issues/127.

## Rejected

- **The Convex CLI's local deployment** (`convex dev` with a local deployment): one fixed data folder and a backend that stops after `--once`, as above.
