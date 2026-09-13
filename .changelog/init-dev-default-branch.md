- **`init.mjs` sets up the two deploy branches** (`scripts/init.mjs`,
  `docs/SETUP.md`, `README.md`): after its commit the script leaves `main` and
  `dev` at that commit with `dev` checked out, renaming a fresh repository's
  only branch to `main` and keeping branches that already exist. `dev` is not
  checked out when it is behind the commit. The `--no-commit` and failure
  warnings print the two branch commands next to the commit command. SETUP.md
  §4 now opens with the repository step: push `dev` first so GitHub makes it
  the default branch and pull requests target it instead of production, with
  `gh repo edit --default-branch dev` as the fix for a repository that already
  had a default. To apply: copy `scripts/init.mjs` and `scripts/init.test.mjs`;
  in an existing project make sure `dev` exists, is not behind `main`, and is
  the default branch (`gh repo view --json defaultBranchRef`).
