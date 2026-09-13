- **Secret-manager field labels** (`docs/SETUP.md`): labels carry no spaces —
  `.` separates namespace elements, `-` separates words within an element
  (`deploy-key`, `api-token`, `web.client-id`), so `op://` references stay
  clean and greppable. A provider section that can hold more than one
  credential prefixes each label with its consumer, named after the `apps/`
  directory it authenticates (`google / web.client-id`, later
  `google / ios.client-id`), and every label states the credential's role
  (`deploy-key`, never `key`). The Secrets & environments rules and every
  `op read` example use the new labels, and §3 names where each Google
  client's id and secret go. To apply: rename `convex / deploy key` to
  `deploy-key`, `cloudflare api token` to `cloudflare / api-token`, and
  `google / client-id` and `client-secret` to `web.client-id` and
  `web.client-secret` in both env items, then re-check any script that reads
  them.
