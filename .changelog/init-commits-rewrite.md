- **`init.mjs` commits its rewrite** (`scripts/init.mjs`, `.github/workflows/ci.yml`):
  the script now ends by committing every file it rewrote as
  `Initialize from template: <name>`; on a repository with no commits yet the
  whole tree is that first commit; only the rewritten paths go in, so local
  edits, staged or not, stay out. `--no-commit` skips it and prints a red
  warning instead, and a run outside a git repository, inside a parent
  directory's repository, or with a failed commit exits 1 with the same
  warning, so the rewrite can no longer sit uncommitted and be dropped by a
  later `git reset --hard`. `TEMPLATE_CHANGELOG.md` is now skipped by the
  rewrite, as the header always claimed. New `--check` mode walks the tree for
  the placeholders and exits 1 naming every file that still has one; CI runs
  it as its first step after install, so a lost rewrite fails there instead
  of at deploy. `scripts/init.test.mjs` covers both, and the root `test`
  script runs it. To apply: copy `scripts/init.mjs` and
  `scripts/init.test.mjs`, add the `Template placeholders` step to `ci.yml`,
  and append `&& bun test scripts/` to the root `test` script.
