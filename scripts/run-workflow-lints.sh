#!/usr/bin/env bash
set -uo pipefail

status=0

run_actionlint() {
  if command -v actionlint >/dev/null 2>&1; then
    actionlint
    return
  fi

  if command -v go >/dev/null 2>&1; then
    go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
    return
  fi

  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "\$ErrorActionPreference = 'Stop'; actionlint"
    return
  fi

  echo "actionlint is not available."
  return 1
}

run_zizmor() {
  if command -v zizmor >/dev/null 2>&1; then
    zizmor --offline --min-severity low .github/workflows
    return
  fi

  if command -v uv >/dev/null 2>&1; then
    uv tool run --from zizmor zizmor --min-severity low .github/workflows
    return
  fi

  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "\$ErrorActionPreference = 'Stop'; uv tool run --from zizmor zizmor --min-severity low .github/workflows"
    return
  fi

  echo "zizmor or uv is not available."
  return 1
}

run_actionlint
status=$((status || $?))

run_zizmor
status=$((status || $?))

exit "$status"
