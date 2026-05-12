# Roadmap — mcp-ssh-tool

Current stable release: **v1.3.3**

---

## v1.4.0 — Resilience & Observability

- [ ] OpenTelemetry opt-in tracing (`OTEL_EXPORTER_OTLP_ENDPOINT` env var activates it)
- [ ] Structured JSON log format for Azure Monitor / Datadog compatibility
- [ ] `get_metrics` — extend with per-process CPU/memory breakdown
- [ ] Session reconnect: auto-reconnect on transient network drops without losing `session_id`
- [ ] `proc_exec` — optional timeout parameter (currently uses server default)

## v1.5.0 — File System & Transfer Improvements

- [ ] `fs_watch` — watch a file or directory for changes, stream events
- [ ] `fs_diff` — diff two remote files and return a unified diff
- [ ] `file_upload` / `file_download` — progress reporting for large files
- [ ] `fs_read` — streaming mode for large files (avoid memory pressure)
- [ ] Checksum verification after `file_upload` (SHA-256)

## v1.6.0 — Security Hardening

- [ ] Strict host key verification mode (`STRICT_HOST_KEY_CHECKING=true`) — enforce by default option
- [ ] Certificate-based auth (SSH certificates, not just key files)
- [ ] Audit log: all `proc_exec` and `proc_sudo` calls written to append-only local log
- [ ] Windows SSH path normalization — `%USERPROFILE%\.ssh\` resolved via `os.homedir()`
- [ ] MCP `resources` exposure: session list as a live resource

## v2.0.0 — Multi-Host Orchestration

- [ ] `fleet_exec` — run the same command on multiple hosts in parallel, return ranked results
- [ ] `fleet_ensure` — apply idempotent state across a group of hosts simultaneously
- [ ] Host groups: define named groups in config (`web-servers`, `db-replicas`)
- [ ] `session_pool` — pre-warm N connections on startup for low-latency automation
- [ ] Drift detection: compare `ensure_*` state across fleet, report divergence

## Won't Do

- Built-in web UI (use `@oaslananka/lab` from mcp-suite instead)
- Windows as a target OS for remote connections
- Agent-based push metrics (pull-only via `get_metrics`)
- Storing SSH credentials or private keys in any database
