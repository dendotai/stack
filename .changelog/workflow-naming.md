- **Workflows named by what runs** (`.github/workflows/`): `ci.yml` is split
  into `test.yml` (jobs `placeholders`, `lint`, `typecheck`, `unit`, in
  parallel) and `build.yml` (job `verify`); every workflow name is lowercase
  (`test`, `build`, `deploy`, `maintenance`), and the deploy job shows its
  target (`deploy (dev)`, `deploy (prod)`). PR check lines read
  `test / lint`, `build / verify`, and so on, so a failed line names the
  failed check. To apply: copy the four files and delete `ci.yml`. A ruleset
  or branch protection that requires the old `check` status must require
  `placeholders`, `lint`, `typecheck`, `unit`, and `verify` instead; make the
  change when the new files merge, because before that no run reports the
  new names, and after it no run reports `check`.
