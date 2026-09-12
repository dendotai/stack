import { createFileRoute } from "@tanstack/react-router";
import { createAuthProxy } from "../../../lib/auth-proxy";

const proxy = createAuthProxy();

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: proxy, POST: proxy } },
});
