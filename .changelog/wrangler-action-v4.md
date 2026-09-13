- **`cloudflare/wrangler-action` bumped to v4** (`.github/workflows/deploy.yml`):
  v3 declares the deprecated `node20` runtime, so every Deploy run annotated
  "Node.js 20 is deprecated"; v4 declares `node24`. v4 also changed the
  default Wrangler it installs to v4 when `wranglerVersion` is unset, and the
  template already sets `wranglerVersion: "4"`, so nothing else changes. To
  apply: change the `uses:` pin in the "Deploy Worker" step to
  `cloudflare/wrangler-action@v4`.
