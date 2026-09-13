- **Root `lint` runs every workspace's own `lint` script:** a workspace that
  `biome.json` excludes because it lints itself (an Expo app with `expo lint`)
  was type-checked and tested in CI but never linted, since only `typecheck`
  and `test` fanned out through `bun --filter '*'`. The root script is now
  `biome check . && bun --filter '*' --if-present lint`; `--if-present` keeps
  it green while no workspace defines `lint` (bun otherwise exits 1 with "No
  packages matched the filter"). `scripts/lint-script.test.mjs` runs the
  script against a throwaway monorepo and fails if the fan-out is dropped.
  To apply: copy the `lint` script into the root `package.json` and copy the
  test file. The first run lints the excluded workspace for the first time —
  expect findings there and fix them in the same commit.
