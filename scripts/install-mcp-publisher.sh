#!/usr/bin/env bash
set -euo pipefail

version="${MCP_PUBLISHER_VERSION:-v1.6.0}"
os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')"
asset="mcp-publisher_${os}_${arch}.tar.gz"
base_url="https://github.com/modelcontextprotocol/registry/releases/download/${version}"

case "${asset}" in
  mcp-publisher_linux_amd64.tar.gz)
    expected_sha256="2de4ac3bf5b2aa9b012291a6969f16e4a2e37b70baab7f066e06998823405d42"
    ;;
  mcp-publisher_linux_arm64.tar.gz)
    expected_sha256="10126a78739f3c1e20a597a8a6fda2f4d80d8f0d93f0061983f365dbb5a104a0"
    ;;
  *)
    echo "Unsupported mcp-publisher asset for this workflow: ${asset}" >&2
    exit 1
    ;;
esac

curl -fsSLo "${asset}" "${base_url}/${asset}"
echo "${expected_sha256}  ${asset}" | sha256sum -c -
tar -xzf "${asset}" mcp-publisher
chmod 0755 mcp-publisher
./mcp-publisher --help >/dev/null
echo "Installed mcp-publisher ${version} (${asset})"
