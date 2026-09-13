- **Agent-skills scaffold** (`docs/agents/`, `CLAUDE.md`): the per-repo config
  that the mattpocock-skills engineering skills read now ships in the template
  instead of coming from each project's own `setup-matt-pocock-skills` run.
  [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) (GitHub
  Issues via `gh`), [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)
  (the five canonical roles plus the state labels `maintenance.yml` manages)
  and [`docs/agents/domain.md`](docs/agents/domain.md) (single-context: root
  `CONTEXT.md` + `docs/adr/`), pointed at by a new `## Agent skills` section at
  the end of `CLAUDE.md`. To apply: copy the three files and append the
  section; a project that already ran the setup skill keeps its own files and
  only reconciles the label table.
