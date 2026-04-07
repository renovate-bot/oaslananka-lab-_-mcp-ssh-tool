# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Please report security issues via one of the following channels:

1. **GitHub Security Advisories** (preferred):
   Go to the repository -> Security tab -> "Report a vulnerability"
2. **Direct e-mail:** `security@oaslananka.dev`

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (optional)

### Response SLA

- **Acknowledgement:** within 48 hours
- **Initial assessment:** within 5 business days
- **Fix or workaround:** within 30 days for critical issues

### Scope

This tool operates over SSH and handles credentials. The following are
**in scope** for security reports:

- Credential leakage in logs or error messages
- Command injection bypasses in `ensurePackage` or similar validators
- Session fixation or session hijacking via the session ID mechanism
- Rate limiter bypass allowing brute-force attacks
- Prototype pollution via JSON input parsing

### Out of Scope

- Vulnerabilities in third-party dependencies (report to their respective projects)
- Issues requiring physical access to the host running the MCP server
- Social engineering attacks
