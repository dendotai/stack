// WorkOS AuthKit access tokens carry one of two `iss` values depending on flow,
// so register both. JWKS URL is non-OIDC-standard (per-client), so use customJwt
// with explicit `jwks` instead of relying on .well-known discovery.
declare const process: { env: Record<string, string | undefined> };

const clientId = process.env.WORKOS_CLIENT_ID;

export default {
  providers: [
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
};
