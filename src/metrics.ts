import { logger } from "./logging.js";

/**
 * Metrics data structure
 */
export interface Metrics {
  sessions: {
    created: number;
    closed: number;
    active: number;
    errors: number;
  };
  commands: {
    executed: number;
    successful: number;
    failed: number;
    totalDurationMs: number;
    avgDurationMs: number;
  };
  files: {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  };
  uptime: number;
  startedAt: number;
}

/**
 * Metrics collector for monitoring and observability
 */
export class MetricsCollector {
  private metrics: Metrics;

  constructor() {
    this.metrics = this.createEmptyMetrics();
  }

  private createEmptyMetrics(): Metrics {
    return {
      sessions: { created: 0, closed: 0, active: 0, errors: 0 },
      commands: {
        executed: 0,
        successful: 0,
        failed: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
      },
      files: { reads: 0, writes: 0, bytesRead: 0, bytesWritten: 0 },
      uptime: 0,
      startedAt: Date.now(),
    };
  }

  /**
   * Record session creation
   */
  recordSessionCreated(): void {
    this.metrics.sessions.created++;
    this.metrics.sessions.active++;
    logger.debug("Metrics: session created", {
      active: this.metrics.sessions.active,
    });
  }

  /**
   * Record session closed
   */
  recordSessionClosed(): void {
    this.metrics.sessions.closed++;
    this.metrics.sessions.active = Math.max(0, this.metrics.sessions.active - 1);
    logger.debug("Metrics: session closed", {
      active: this.metrics.sessions.active,
    });
  }

  /**
   * Record session error
   */
  recordSessionError(): void {
    this.metrics.sessions.errors++;
  }

  /**
   * Record command execution
   */
  recordCommand(durationMs: number, success: boolean): void {
    this.metrics.commands.executed++;
    this.metrics.commands.totalDurationMs += durationMs;
    this.metrics.commands.avgDurationMs =
      this.metrics.commands.totalDurationMs / this.metrics.commands.executed;

    if (success) {
      this.metrics.commands.successful++;
    } else {
      this.metrics.commands.failed++;
    }
  }

  /**
   * Record file read
   */
  recordFileRead(bytes: number): void {
    this.metrics.files.reads++;
    this.metrics.files.bytesRead += bytes;
  }

  /**
   * Record file write
   */
  recordFileWrite(bytes: number): void {
    this.metrics.files.writes++;
    this.metrics.files.bytesWritten += bytes;
  }

  /**
   * Get current metrics
   */
  getMetrics(): Metrics {
    return {
      ...this.metrics,
      sessions: { ...this.metrics.sessions },
      commands: { ...this.metrics.commands },
      files: { ...this.metrics.files },
      uptime: Date.now() - this.metrics.startedAt,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const m = this.getMetrics();
    const lines: string[] = [
      "# HELP ssh_mcp_sessions_total Total number of SSH sessions",
      "# TYPE ssh_mcp_sessions_total counter",
      `ssh_mcp_sessions_created ${m.sessions.created}`,
      `ssh_mcp_sessions_closed ${m.sessions.closed}`,
      `ssh_mcp_sessions_errors ${m.sessions.errors}`,
      "",
      "# HELP ssh_mcp_sessions_active Current active sessions",
      "# TYPE ssh_mcp_sessions_active gauge",
      `ssh_mcp_sessions_active ${m.sessions.active}`,
      "",
      "# HELP ssh_mcp_commands_total Total number of commands executed",
      "# TYPE ssh_mcp_commands_total counter",
      `ssh_mcp_commands_executed ${m.commands.executed}`,
      `ssh_mcp_commands_successful ${m.commands.successful}`,
      `ssh_mcp_commands_failed ${m.commands.failed}`,
      "",
      "# HELP ssh_mcp_command_duration_ms Average command duration",
      "# TYPE ssh_mcp_command_duration_ms gauge",
      `ssh_mcp_command_duration_avg_ms ${m.commands.avgDurationMs.toFixed(2)}`,
      "",
      "# HELP ssh_mcp_files_total File operations",
      "# TYPE ssh_mcp_files_total counter",
      `ssh_mcp_files_reads ${m.files.reads}`,
      `ssh_mcp_files_writes ${m.files.writes}`,
      `ssh_mcp_files_bytes_read ${m.files.bytesRead}`,
      `ssh_mcp_files_bytes_written ${m.files.bytesWritten}`,
      "",
      "# HELP ssh_mcp_uptime_ms Server uptime in milliseconds",
      "# TYPE ssh_mcp_uptime_ms gauge",
      `ssh_mcp_uptime_ms ${m.uptime}`,
    ];

    return lines.join("\n");
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = this.createEmptyMetrics();
    logger.info("Metrics reset");
  }
}
