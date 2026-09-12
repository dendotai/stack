- **Repo-hygiene workflow** (`.github/workflows/maintenance.yml`): one
  workflow for lightweight automation, one job per concern, run on every
  issue close and on manual dispatch. `close-finished-tracking-parents`
  closes every open `tracking` issue whose sub-issues are all closed, so a
  split parent closes with its last child instead of lingering. Then
  `strip-state-labels` removes the live triage-state labels (`needs-triage`,
  `needs-info`, `ready-for-agent`, `ready-for-human`, `tracking`,
  `in-progress`, `needs-human`, `in-review`) from every closed issue;
  `wontfix` stays as the record of why. Jobs sweep the whole repo, so a
  missed event self-heals on the next run. Issue-triggered workflows run from
  the repo's default branch: in a `dev` → `main` flow the file is live only
  once it reaches `main`. To apply: copy the file, and make sure the labels
  it names exist (`gh label create <name>` for any missing one; the parent
  close also needs children attached as native sub-issues, which
  `/to-tickets` does).
