import { createStart } from "@tanstack/react-start";

// Nothing to configure: auth travels over the `/api/auth/$` proxy, not a
// request middleware. Keep the file even so: the generated route tree is
// typechecked, and the footer the Vite plugin emits for a missing start file
// carries an unused import that `noUnusedLocals` rejects (CLAUDE.md, Route
// files).
export const startInstance = createStart(() => ({}));
