// The origin the screenshot tooling drives. `STACK_BASE_URL` always wins. A
// worktree sets `PORT` (see ../.env.local.example) and has no devsite front,
// so its app is plain http on localhost; the main checkout keeps the devsite
// origin.
export function baseUrl(env = process.env) {
  if (env.STACK_BASE_URL) return env.STACK_BASE_URL;
  if (env.PORT) return `http://localhost:${env.PORT}`;
  return "https://stack.internal";
}
