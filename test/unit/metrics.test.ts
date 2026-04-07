import { beforeEach, describe, expect, test } from "@jest/globals";
import { MetricsCollector } from "../../src/metrics.js";

describe("MetricsCollector", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  test("starts with zeroed metrics", () => {
    const snapshot = metrics.getMetrics();

    expect(snapshot.sessions.created).toBe(0);
    expect(snapshot.commands.executed).toBe(0);
    expect(snapshot.files.reads).toBe(0);
  });

  test("records session lifecycle and errors", () => {
    metrics.recordSessionCreated();
    metrics.recordSessionCreated();
    metrics.recordSessionClosed();
    metrics.recordSessionError();

    const snapshot = metrics.getMetrics();
    expect(snapshot.sessions.created).toBe(2);
    expect(snapshot.sessions.closed).toBe(1);
    expect(snapshot.sessions.active).toBe(1);
    expect(snapshot.sessions.errors).toBe(1);
  });

  test("active sessions never go below zero", () => {
    metrics.recordSessionClosed();
    expect(metrics.getMetrics().sessions.active).toBe(0);
  });

  test("records commands and files", () => {
    metrics.recordCommand(100, true);
    metrics.recordCommand(300, false);
    metrics.recordFileRead(12);
    metrics.recordFileWrite(42);

    const snapshot = metrics.getMetrics();
    expect(snapshot.commands.executed).toBe(2);
    expect(snapshot.commands.successful).toBe(1);
    expect(snapshot.commands.failed).toBe(1);
    expect(snapshot.commands.avgDurationMs).toBe(200);
    expect(snapshot.files.bytesRead).toBe(12);
    expect(snapshot.files.bytesWritten).toBe(42);
  });

  test("exportPrometheus includes expected counters", () => {
    metrics.recordSessionCreated();
    metrics.recordCommand(50, true);

    const prometheus = metrics.exportPrometheus();
    expect(prometheus).toContain("ssh_mcp_sessions_created 1");
    expect(prometheus).toContain("ssh_mcp_sessions_active 1");
    expect(prometheus).toContain("ssh_mcp_commands_successful 1");
  });

  test("reset clears counters and updates start time", () => {
    metrics.recordSessionCreated();
    const beforeReset = metrics.getMetrics().startedAt;
    metrics.reset();
    const afterReset = metrics.getMetrics();

    expect(afterReset.sessions.created).toBe(0);
    expect(afterReset.startedAt).toBeGreaterThanOrEqual(beforeReset);
  });
});
