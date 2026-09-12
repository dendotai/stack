- **Where unreleased template entries live** (`README.md`,
  `TEMPLATE_CHANGELOG.md`): `dendotai/stack` now keeps every unreleased entry
  as its own file in a `.changelog/` directory at its repo root, so two open
  pull requests never edit the same changelog line. `TEMPLATE_CHANGELOG.md`
  holds released versions only, and its `## [Unreleased]` section is a pointer
  at that directory; a release folds the files in and empties it. "Updating a
  project from the template" step 2 therefore reads both — the released
  sections of the changelog, and the pending entries in `.changelog/`. To
  apply: copy the `## [Unreleased]` section of `TEMPLATE_CHANGELOG.md` and
  step 2 of `README.md`.
