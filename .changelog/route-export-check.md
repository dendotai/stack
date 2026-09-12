- **A test enforces the route export rule** (`apps/web`,
  [ADR 0005](docs/adr/0005-route-component-colocation.md)): `src/routes.test.ts`
  parses every file under `src/routes/` with the TypeScript compiler API and
  fails when it finds a value export other than `Route`. It skips `-` prefixed
  directories and `*.test.*` files — the same two exclusions the route
  generator uses — and allows type-only exports, which are erased before
  bundling (`__root.tsx` exports `RouterAppContext`). It covers the
  `export { X }`, `export * from`, `export default` and destructuring forms a
  regex would miss. The failure names the file, the line, the offending export
  and the fix. It runs under `bun run test`, which CI already runs, so a route
  can no longer lose code-splitting silently. To apply: copy
  `apps/web/src/routes.test.ts`.
