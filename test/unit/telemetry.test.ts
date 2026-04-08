import { afterEach, describe, expect, test } from "@jest/globals";
import {
  getTelemetryConfig,
  initTelemetry,
  isTelemetryEnabled,
  normalizeOtlpEndpoint,
  shutdownTelemetry,
  withSpan,
} from "../../src/telemetry.js";

describe("telemetry helpers", () => {
  afterEach(async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OTEL_SERVICE_VERSION;
    delete process.env.NODE_ENV;
    await shutdownTelemetry();
  });

  test("derives disabled config when OTLP endpoint is missing", () => {
    const config = getTelemetryConfig({});

    expect(config.enabled).toBe(false);
    expect(config.serviceName).toBe("mcp-ssh-tool");
  });

  test("normalizes OTLP trace endpoints", () => {
    expect(normalizeOtlpEndpoint("http://localhost:4318")).toBe("http://localhost:4318/v1/traces");
    expect(normalizeOtlpEndpoint("http://localhost:4318/v1/traces")).toBe(
      "http://localhost:4318/v1/traces",
    );
  });

  test("does not enable telemetry without an endpoint", () => {
    expect(initTelemetry()).toBe(false);
    expect(isTelemetryEnabled()).toBe(false);
  });

  test("withSpan executes work even when telemetry is inactive", async () => {
    const result = await withSpan("test.span", async (span) => {
      span.setAttribute("example", "value");
      return 42;
    });

    expect(result).toBe(42);
  });
});
