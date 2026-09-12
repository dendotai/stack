- **Biome config matched to the installed CLI:** `biome.json` now declares
  schema 2.5.1 (the version `bun.lock` installs) and uses `preset:
  "recommended"` instead of the deprecated `recommended: true`.
  `@biomejs/biome` is pinned exactly (`2.5.1`, no caret) so a non-frozen
  `bun install` cannot pull a newer CLI than the schema. To apply: pin
  `@biomejs/biome` to an exact version in the root `package.json`, run
  `bun install`, then `bunx biome migrate --write` and commit all three files.
