import { createSign, generateKeyPairSync, type JsonWebKey, type KeyLike } from "node:crypto";
import { afterEach, describe, expect, test } from "@jest/globals";
import { verifyOAuthAuthorization } from "../../src/oauth.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("OAuth verification", () => {
  test("accepts a valid RS256 JWT with issuer audience and required scope", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey & { kid?: string };
    jwk.kid = "test-key";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        alg: "RS256",
        kid: "test-key",
        typ: "JWT",
      },
      {
        iss: "https://auth.example",
        aud: "https://mcp.example/mcp",
        exp: now + 300,
        scope: "mcp-ssh-tool.read",
      },
      privateKey,
    );

    await expect(
      verifyOAuthAuthorization(`Bearer ${token}`, {
        issuer: "https://auth.example",
        audience: "https://mcp.example/mcp",
        jwksUrl: "https://auth.example/.well-known/jwks.json",
        requiredScopes: ["mcp-ssh-tool.read"],
      }),
    ).resolves.toEqual(expect.objectContaining({ iss: "https://auth.example" }));
  });

  test("rejects tokens missing required scopes", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey & { kid?: string };
    jwk.kid = "test-key-scope";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      { alg: "RS256", kid: "test-key-scope" },
      {
        iss: "https://auth.example",
        aud: "https://mcp.example/mcp",
        exp: now + 300,
        scope: "other.scope",
      },
      privateKey,
    );

    await expect(
      verifyOAuthAuthorization(`Bearer ${token}`, {
        issuer: "https://auth.example",
        audience: "https://mcp.example/mcp",
        jwksUrl: "https://auth.example/.well-known/jwks.json?scope",
        requiredScopes: ["mcp-ssh-tool.read"],
      }),
    ).rejects.toThrow("required scope");
  });

  test("rejects invalid audience, expired token, and bad signatures", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const otherKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey & { kid?: string };
    jwk.kid = "test-key-negative";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const now = Math.floor(Date.now() / 1000);
    const config = {
      issuer: "https://auth.example",
      audience: "https://mcp.example/mcp",
      jwksUrl: "https://auth.example/.well-known/jwks.json?negative",
      requiredScopes: ["mcp-ssh-tool.read"],
    };

    await expect(
      verifyOAuthAuthorization(
        `Bearer ${signJwt(
          { alg: "RS256", kid: "test-key-negative" },
          {
            iss: "https://auth.example",
            aud: "https://wrong.example/mcp",
            exp: now + 300,
            scope: "mcp-ssh-tool.read",
          },
          privateKey,
        )}`,
        config,
      ),
    ).rejects.toThrow("audience");

    await expect(
      verifyOAuthAuthorization(
        `Bearer ${signJwt(
          { alg: "RS256", kid: "test-key-negative" },
          {
            iss: "https://auth.example",
            aud: "https://mcp.example/mcp",
            exp: now - 1,
            scope: "mcp-ssh-tool.read",
          },
          privateKey,
        )}`,
        config,
      ),
    ).rejects.toThrow("expired");

    await expect(
      verifyOAuthAuthorization(
        `Bearer ${signJwt(
          { alg: "RS256", kid: "test-key-negative" },
          {
            iss: "https://auth.example",
            aud: "https://mcp.example/mcp",
            exp: now + 300,
            scope: "mcp-ssh-tool.read",
          },
          otherKeyPair.privateKey,
        )}`,
        config,
      ),
    ).rejects.toThrow("signature");
  });
});

function signJwt(header: object, payload: object, privateKey: KeyLike): string {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

function base64Url(value: string | Buffer): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
