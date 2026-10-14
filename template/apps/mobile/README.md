# @stack/mobile

Placeholder for a future Expo mobile app. Empty by design — the structure is planned now so the slot is obvious; the app is built later.

Bun workspaces glob `apps/*` and `packages/*` from the root `package.json`, so this directory is picked up even without a `package.json` of its own. When you're ready, scaffold an Expo app here and have it consume `@stack/api` (the Convex schema + generated client) the way `apps/web` does.

Per-user settings: read `settings.getForCaller` and write `settings.set`, the same store the web app uses ([ADR 0010](../../docs/adr/0010-user-settings-one-store.md)).

Expo lints with ESLint (`expo lint`), not Biome. Exclude this directory in the root `biome.json` and give the app a `lint` script: the root `lint` runs every workspace's `lint` script after Biome, so CI lints the app too.
