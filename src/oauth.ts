import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";
import { extractBearerToken } from "./auth.js";

export interface OAuthVerificationConfig {
  issuer?: string;
  audience?: string;
  jwksUrl?: string;
  requiredScopes: string[];
}

interface JwksResponse {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string }>;
}

const jwksCache = new Map<string, { expiresAt: number; jwks: JwksResponse }>();

export async function isOAuthAuthorizationValid(
  authorization: string | undefined,
  config: OAuthVerificationConfig,
): Promise<boolean> {
  try {
    await verifyOAuthAuthorization(authorization, config);
    return true;
  } catch {
    return false;
  }
}

export async function verifyOAuthAuthorization(
  authorization: string | undefined,
  config: OAuthVerificationConfig,
): Promise<Record<string, unknown>> {
  if (!config.issuer || !config.audience || !config.jwksUrl) {
    throw new Error("OAuth issuer, audience, and JWKS URL are required");
  }

  const token = extractBearerToken(authorization);
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Malformed JWT");
  }

  const header = parseBase64UrlJson(encodedHeader) as {
    alg?: string;
    kid?: string;
    typ?: string;
  };
  if (header.alg !== "RS256") {
    throw new Error("Unsupported JWT algorithm");
  }
  if (!header.kid) {
    throw new Error("JWT kid is required");
  }

  const payload = parseBase64UrlJson(encodedPayload);
  const jwks = await fetchJwks(config.jwksUrl);
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new Error("JWT signing key not found");
  }

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  if (!verifier.verify(publicKey, base64UrlToBuffer(encodedSignature))) {
    throw new Error("JWT signature verification failed");
  }

  validateClaims(payload, config);
  return payload;
}

function parseBase64UrlJson(value: string): Record<string, unknown> {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as Record<string, unknown>;
}

function base64UrlToBuffer(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

async function fetchJwks(jwksUrl: string): Promise<JwksResponse> {
  const cached = jwksCache.get(jwksUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.jwks;
  }

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const jwks = (await response.json()) as JwksResponse;
  jwksCache.set(jwksUrl, { jwks, expiresAt: Date.now() + 5 * 60 * 1000 });
  return jwks;
}

function validateClaims(payload: Record<string, unknown>, config: OAuthVerificationConfig): void {
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== config.issuer) {
    throw new Error("JWT issuer mismatch");
  }
  if (!audienceMatches(payload.aud, config.audience ?? "")) {
    throw new Error("JWT audience mismatch");
  }
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("JWT is expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("JWT is not valid yet");
  }
  if (typeof payload.iat === "number" && payload.iat > now + 60) {
    throw new Error("JWT issued-at time is in the future");
  }

  const scopes = extractScopes(payload);
  for (const requiredScope of config.requiredScopes) {
    if (!scopes.has(requiredScope)) {
      throw new Error("JWT required scope is missing");
    }
  }
}

function audienceMatches(audience: unknown, expected: string): boolean {
  return audience === expected || (Array.isArray(audience) && audience.includes(expected));
}

function extractScopes(payload: Record<string, unknown>): Set<string> {
  const scopes = new Set<string>();
  if (typeof payload.scope === "string") {
    for (const scope of payload.scope.split(/\s+/).filter(Boolean)) {
      scopes.add(scope);
    }
  }
  if (typeof payload.scp === "string") {
    for (const scope of payload.scp.split(/\s+/).filter(Boolean)) {
      scopes.add(scope);
    }
  }
  if (Array.isArray(payload.scp)) {
    for (const scope of payload.scp) {
      if (typeof scope === "string") {
        scopes.add(scope);
      }
    }
  }
  return scopes;
}
