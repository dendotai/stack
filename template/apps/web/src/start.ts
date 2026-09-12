import { createStart } from "@tanstack/react-start";

// Nothing to configure: auth travels over the `/api/auth/$` proxy, not a
// request middleware. The file stays because the generated route tree types
// its config off this instance.
export const startInstance = createStart(() => ({}));
