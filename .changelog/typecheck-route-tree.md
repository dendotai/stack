- **`tsc` checks the generated route tree** (`apps/web`): `routeTreeFileHeader`
  in `tsr.config.json` omits the generator's default `// @ts-nocheck`, so a
  stale name in the footer the Vite plugin appends (the `getRouter` and
  `startInstance` type imports that register the router and the Start config)
  is a type error instead of silence. Both generator outputs pass `tsc` with
  `src/start.ts` present; `apps/web/CLAUDE.md` records why that file stays even
  while it configures nothing. To apply: copy the `routeTreeFileHeader` line
  from `apps/web/tsr.config.json` and the two paragraphs after "Its options live
  in `tsr.config.json`" in `apps/web/CLAUDE.md`, then run `bun run typecheck`.
