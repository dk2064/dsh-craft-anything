#!/usr/bin/env bash
# dsh-craft-anything — installer for macOS and Linux.
#
# It downloads the upstream Craft Anything CLI into ~/.dsh/tools/craft-anything
# and checks that it answers --version. It does not register an MCP server: the
# plugin ships cordis.patch.yml for that, and running upstream `setup --yes`
# over an entry DSH already manages would drop its --deep flag.
#
# Usage:
#   ./install.sh              # latest release
#   ./install.sh 0.6.1        # pin a version
#   FORCE=1 ./install.sh      # re-download even if present
set -euo pipefail

repo="storytold/craft-anything"
dest="${HOME}/.dsh/tools/craft-anything"
version="${1:-}"
exe="${dest}/craft-anything-cli"

case "$(uname -s)" in
  Darwin) os="macos" ;;
  Linux)  os="linux" ;;
  *) echo "unsupported OS: $(uname -s) — Windows users run install.ps1" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64)  arch="x64" ;;
  *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac

if [ -x "$exe" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "already installed: $exe ($("$exe" --version 2>/dev/null || echo 'unknown'))"
  echo "set FORCE=1 to re-download."
  exit 0
fi

echo "resolving release of ${repo} ..."
if [ -n "$version" ]; then
  api="https://api.github.com/repos/${repo}/releases/tags/v${version}"
else
  api="https://api.github.com/repos/${repo}/releases/latest"
fi
json="$(curl -fsSL -H 'User-Agent: dsh-craft-anything-installer' "$api")"

url="$(printf '%s' "$json" \
  | grep -o "\"browser_download_url\"[[:space:]]*:[[:space:]]*\"[^\"]*${os}-${arch}[^\"]*\\.tar\\.gz\"" \
  | head -n1 | sed 's/.*"\(https[^"]*\)"/\1/')"
if [ -z "$url" ]; then
  url="$(printf '%s' "$json" \
    | grep -o "\"browser_download_url\"[[:space:]]*:[[:space:]]*\"[^\"]*${os}-${arch}[^\"]*\.zip\"" \
    | head -n1 | sed 's/.*"\(https[^"]*\)"/\1/')"
fi
if [ -z "$url" ]; then
  echo "no ${os}-${arch} asset in that release" >&2
  exit 1
fi

mkdir -p "$dest"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "downloading $(basename "$url") ..."
curl -fsSL -H 'User-Agent: dsh-craft-anything-installer' "$url" -o "$tmp/pkg"

case "$url" in
  *.tar.gz) tar -xzf "$tmp/pkg" -C "$dest" ;;
  *.zip)    unzip -oq "$tmp/pkg" -d "$dest" ;;
  *) echo "unknown archive type: $url" >&2; exit 1 ;;
esac

if [ ! -x "$exe" ]; then
  found="$(find "$dest" -type f -name 'craft-anything-cli' | head -n1 || true)"
  if [ -n "$found" ]; then chmod +x "$found"; exe="$found"; else
    echo "archive extracted but craft-anything-cli is missing under $dest" >&2; exit 1
  fi
fi

echo "installed: $exe"
echo "version: $("$exe" --version)"
cat <<'EOF'

next:
  1. set the plugin config `executable` to that path (cordis.patch.yml defaults to
     the portable form %USERPROFILE%\.dsh\... on Windows — change it on this machine);
  2. restart DSH so the bridge picks up the new tool surface;
  3. in a session, `craft_engine` with action `status` to see engines and the current surface.
EOF
