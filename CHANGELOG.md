# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-04-01

### Fixed

- **CRITICAL**: `scripts/setup-chatgpt.js` ESM/CJS uyumsuzluğu düzeltildi
- **CRITICAL**: `detect.ts` RHEL sürüm tespiti regex düzeltildi
- **CRITICAL**: `patch_apply` tool alan adı uyumsuzluğu (`patch` → `diff`) düzeltildi
- **CRITICAL**: `ensure_package` ve `ensure_lines_in_file` araçlarına `absent` state eklendi
- `commander` v14 için Node.js engine gereksinimleri güncellendi (`>=20`)
- `STRICT_HOST_KEY_CHECKING` env değişkeni artık `session.ts` tarafından okunuyor
- E2E testlerdeki `FileStatInfo.isFile` ve `DirListResult` tip hataları düzeltildi
- `fs-tools.ts` SFTP stat tip tespiti güvenli hale getirildi

### Added

- `absent` state desteği: `ensure_package` artık paket kaldırabilir
- `absent` state desteği: `ensure_lines_in_file` artık satır silebilir
- `ensure_service` tool'una `restarted` state eklendi
- `get_metrics` tool'u ile sunucu performans metrikleri sorgulanabilir
- Rate limiter artık MCP handler'a entegre edildi
- Sürüm senkronizasyonu için `scripts/sync-version.mjs` eklendi
- SSH config cache 5 dakikalık TTL ile yenileme desteği eklendi

### Changed

- Çift SSH bağlantısı kaldırıldı; `NodeSSH` dahili SFTP kanalı kullanılıyor
- `ssh2-sftp-client` bağımlılığı kaldırıldı
- README API Reference güncellendi (underscore tool isimleri)
- CI/CD Azure DevOps'a taşındı

### Security

- Bağlantı açılışında host key doğrulama durumu log'a yazılıyor

## [1.2.5] - 2026-01-31

### Fixed

- **CRITICAL**: Tool names now use underscore format (`ssh_open_session`) instead of dot-notation (`ssh.openSession`) to comply with MCP protocol specification. Old names still work via aliases for backward compatibility.
- Session cleanup interval reduced from 60s to 10s for better resource management
- Added proper `destroy()` method to SessionManager for clean shutdown

### Security

- **DSA key support removed**: DSA keys are deprecated (disabled by default since OpenSSH 8.8) and should not be used
- **Command injection protection**: Added package name validation in `ensurePackage()` to prevent shell injection attacks

### Changed

- TOOL_ALIASES now maps old dot-notation names to new underscore names (backwards compatible)

## [1.1.0] - 2026-01-02

### Added

- SSH config file parsing (`~/.ssh/config` support)
- `ssh.listSessions` tool to list all active sessions
- `ssh.ping` tool to check connection health
- `ssh.listConfiguredHosts` tool to list configured hosts
- `ssh.resolveHost` tool to resolve host aliases
- Safety warning system for dangerous commands (non-blocking)
- Auto-reconnect capability for dropped connections
- Command timeout support (`timeoutMs` parameter)
- Streaming output for long-running commands (`streaming.ts`)
- Port forwarding support (local/remote tunnels via `tunnel.ts`)
- File transfer with progress tracking (`transfer.ts`)
- Docker-based test environment (`docker-compose.yml`)
- Jest coverage configuration
- TypeDoc API documentation support
- Comprehensive documentation (CONTRIBUTING.md, examples/)

### Changed

- Improved error messages with actionable hints
- Enhanced session management with heartbeat monitoring

### Security

- Added safety warnings for potentially dangerous commands
- Improved sensitive data redaction in logs

## [1.0.0] - 2025-01-01

### Added

- Initial release
- SSH session management (open/close)
- Command execution (`proc.exec`, `proc.sudo`)
- File system operations (read, write, stat, list, mkdir, rm, rename)
- Package management (`ensure.package`)
- Service management (`ensure.service`)
- Line-in-file management (`ensure.linesInFile`)
- Patch application (`patch.apply`)
- OS detection (`os.detect`)
- Multiple authentication methods (password, key, agent)
- SSH key auto-discovery
- LRU session cache with TTL
- Sensitive data redaction in logs

[1.0.0]: https://github.com/oaslananka/mcp-ssh-tool/releases/tag/v1.0.0
