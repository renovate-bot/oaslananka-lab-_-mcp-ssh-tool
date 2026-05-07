import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import { DEFAULT_CONFIG, type ServerConfig } from "../../src/config.js";
import { resolveConnectorCredentials } from "../../src/connector-credentials.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = undefined;
  }
});

describe("connector credential resolver", () => {
  test("validates command-provider output and does not require chat credentials", async () => {
    const script = writeResolverScript(
      'console.log(JSON.stringify({ host: "prod.example", username: "deploy", auth: "agent", hostKeyPolicy: "strict" }));',
    );

    await expect(
      resolveConnectorCredentials({ hostAlias: "prod", purpose: "inspect" }, configFor(script)),
    ).resolves.toEqual(
      expect.objectContaining({
        host: "prod.example",
        policyHost: "prod",
        username: "deploy",
        auth: "agent",
        useAgent: true,
        hostKeyPolicy: "strict",
      }),
    );
  });

  test("rejects credential command output that includes forbidden secret fields", async () => {
    const script = writeResolverScript(
      'console.log(JSON.stringify({ host: "prod.example", username: "deploy", password: "super-secret" }));',
    );

    await expect(
      resolveConnectorCredentials({ hostAlias: "prod", purpose: "inspect" }, configFor(script)),
    ).rejects.toThrow("Unrecognized key");
  });

  test("enforces credential command timeout", async () => {
    const script = writeResolverScript("setTimeout(() => {}, 5000);");

    await expect(
      resolveConnectorCredentials(
        { hostAlias: "prod", purpose: "inspect" },
        configFor(script, { credentialCommandTimeoutMs: 50 }),
      ),
    ).rejects.toThrow("timed out");
  });
});

function writeResolverScript(source: string): string {
  tempDir = mkdtempSync(join(tmpdir(), "mcp-ssh-tool-credentials-"));
  const scriptPath = join(tempDir, "resolver.mjs");
  writeFileSync(scriptPath, source);
  return scriptPath;
}

function configFor(
  scriptPath: string,
  connectorOverrides: Partial<ServerConfig["connector"]> = {},
): ServerConfig {
  return {
    ...DEFAULT_CONFIG,
    connector: {
      ...DEFAULT_CONFIG.connector,
      credentialProvider: "command",
      credentialCommand: process.execPath,
      credentialCommandArgs: [scriptPath],
      ...connectorOverrides,
    },
  };
}
