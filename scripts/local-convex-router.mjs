#!/usr/bin/env bun
// One origin in front of a local Convex backend, for acceptance passes against
// the template (this repo never deploys it — see CLAUDE.md).
//
// A cloud deployment answers the client API on `<name>.convex.cloud` and the
// HTTP router — where Better Auth lives — on `<name>.convex.site`, so the web
// app derives the second host from the first by a suffix swap and needs no
// second build variable. A local backend puts the two on one host and two
// ports, where that swap is a no-op. This router merges the ports back into one
// origin so the swap stays correct and the app keeps its single variable.
//
// Point `VITE_CONVEX_URL` at this router, not at the backend.

const port = Number(process.env.ROUTER_PORT ?? 3200);
const client = process.env.CONVEX_CLIENT_ORIGIN ?? "http://127.0.0.1:3210";
const site = process.env.CONVEX_SITE_ORIGIN ?? "http://127.0.0.1:3211";

// Every Better Auth endpoint sits under this prefix. The client API's own
// `/api/...` paths (`/api/<version>/sync`, `/api/query`) never enter it.
const AUTH_PREFIX = "/api/auth/";

function upstreamFor(pathname) {
  return pathname.startsWith(AUTH_PREFIX) ? site : client;
}

const server = Bun.serve({
  port,
  // Loopback only. Behind this router sits an unauthenticated local backend.
  hostname: "127.0.0.1",
  idleTimeout: 0,
  fetch(request, server) {
    const url = new URL(request.url);
    const target = `${upstreamFor(url.pathname)}${url.pathname}${url.search}`;

    // The Convex client syncs over a WebSocket, so the router has to carry one.
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const opened = server.upgrade(request, {
        data: { target: target.replace(/^http/, "ws"), queue: [] },
      });
      return opened ? undefined : new Response("upgrade failed", { status: 400 });
    }

    const headers = new Headers(request.headers);
    // Hop-by-hop headers describe the inbound connection; forwarding them makes
    // the outbound fetch reject the body.
    headers.delete("connection");
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    headers.set("host", new URL(upstreamFor(url.pathname)).host);
    // An encoded response would reach the caller carrying a `content-encoding`
    // the runtime already stripped while decoding it.
    headers.set("accept-encoding", "identity");

    return fetch(target, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
      duplex: "half",
    });
  },
  websocket: {
    open(ws) {
      const upstream = new WebSocket(ws.data.target);
      ws.data.upstream = upstream;
      // The browser can send before the upstream socket finishes opening.
      upstream.addEventListener("open", () => {
        for (const message of ws.data.queue) upstream.send(message);
        ws.data.queue = [];
      });
      upstream.addEventListener("message", (event) => ws.send(event.data));
      // Relay the code and reason: a backend restart must not reach the client
      // as a clean shutdown, which it would reconnect from differently.
      upstream.addEventListener("close", (event) => ws.close(event.code, event.reason));
      upstream.addEventListener("error", () => ws.close());
    },
    message(ws, message) {
      const upstream = ws.data.upstream;
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(message);
      // Only a socket still connecting will ever flush the queue. Once the
      // upstream is closing, queueing would drop the frame in silence.
      else if (upstream?.readyState === WebSocket.CONNECTING) ws.data.queue.push(message);
      else ws.close();
    },
    close(ws) {
      ws.data.upstream?.close();
    },
  },
});

console.log(`router  http://127.0.0.1:${server.port}`);
console.log(`  ${AUTH_PREFIX}*  ->  ${site}`);
console.log(`  everything else  ->  ${client}`);
