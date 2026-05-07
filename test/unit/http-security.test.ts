import { describe, expect, test } from "@jest/globals";
import {
  corsHeaders,
  isLoopbackHost,
  isOriginAllowed,
  validateHttpStartupConfig,
} from "../../src/http-security.js";

describe("HTTP transport security guards", () => {
  test("accepts loopback startup without bearer token", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "127.0.0.1",
          allowedOrigins: ["http://127.0.0.1", "http://localhost"],
        },
        undefined,
      ),
    ).not.toThrow();
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
  });

  test("rejects non-loopback startup without bearer token and origins", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "0.0.0.0",
          allowedOrigins: [],
        },
        undefined,
      ),
    ).toThrow("Refusing non-loopback HTTP MCP binding");
  });

  test("rejects empty bearer token files", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "0.0.0.0",
          allowedOrigins: ["https://chatgpt.com"],
          bearerTokenFile: "/tmp/token",
        },
        "",
      ),
    ).toThrow("empty bearer token file");
  });

  test("allows non-loopback startup only with bearer token and origins", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "0.0.0.0",
          allowedOrigins: ["https://chatgpt.com"],
          bearerTokenFile: "/tmp/token",
        },
        "secret",
        {
          toolProfile: "remote-readonly",
          allowedHosts: ["prod"],
          authMode: "bearer",
          oauthConfigured: false,
        },
      ),
    ).not.toThrow();
  });

  test("rejects non-loopback startup with full tool profile", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "0.0.0.0",
          allowedOrigins: ["https://chatgpt.com"],
          bearerTokenFile: "/tmp/token",
        },
        "secret",
        {
          toolProfile: "full",
          allowedHosts: ["prod"],
          authMode: "bearer",
          oauthConfigured: false,
        },
      ),
    ).toThrow("full tool profile");
  });

  test("rejects non-loopback startup without host allowlist", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "0.0.0.0",
          allowedOrigins: ["https://chatgpt.com"],
          bearerTokenFile: "/tmp/token",
        },
        "secret",
        {
          toolProfile: "remote-readonly",
          allowedHosts: [],
          authMode: "bearer",
          oauthConfigured: false,
        },
      ),
    ).toThrow("SSH_MCP_ALLOWED_HOSTS");
  });

  test("allows non-loopback startup with OAuth config and safe profile", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "0.0.0.0",
          allowedOrigins: ["https://chatgpt.com"],
        },
        undefined,
        {
          toolProfile: "remote-broker",
          allowedHosts: ["prod"],
          authMode: "oauth",
          oauthConfigured: true,
        },
      ),
    ).not.toThrow();
  });

  test("rejects non-loopback startup without strict host-key verification", () => {
    expect(() =>
      validateHttpStartupConfig(
        {
          host: "0.0.0.0",
          allowedOrigins: ["https://chatgpt.com"],
          bearerTokenFile: "/tmp/token",
        },
        "secret",
        {
          toolProfile: "chatgpt",
          allowedHosts: ["prod"],
          hostKeyPolicy: "accept-new",
          authMode: "bearer",
          oauthConfigured: false,
        },
      ),
    ).toThrow("strict SSH host-key");
  });

  test("applies origin allowlist and CORS headers", () => {
    const origins = ["https://chatgpt.com"];

    expect(isOriginAllowed("https://chatgpt.com", origins)).toBe(true);
    expect(isOriginAllowed("https://evil.example", origins)).toBe(false);
    expect(corsHeaders("https://chatgpt.com", origins)).toEqual(
      expect.objectContaining({
        "Access-Control-Allow-Origin": "https://chatgpt.com",
        Vary: "Origin",
      }),
    );
    expect(corsHeaders("https://evil.example", origins)).toEqual({});
  });
});
