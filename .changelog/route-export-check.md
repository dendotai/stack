- **A test enforces the route export rule** (`apps/web`,
  [ADR 0005](docs/adr/0005-route-component-colocation.md)): `src/routes.test.ts`
  parses every file under the routes directory with the TypeScript compiler API
  and fails unless that file's value exports are exactly `Route`. Type-only
  exports stay legal — they are erased before bundling, and `__root.tsx` exports
  `RouterAppContext`. It covers the `export { X }`, `export * from`,
  `export default` and destructuring forms a regex would miss. The scan reads
  `routesDirectory` and `routeFileIgnorePattern` from `tsr.config.json` and
  skips `-` prefixed names, so it sees exactly the files the route generator
  sees. The failure names the file, the line, the offending export and the fix.
  It runs under `bun run test`, which CI already runs, so a route can no longer
  lose code-splitting silently. To apply: copy `apps/web/src/routes.test.ts`.
