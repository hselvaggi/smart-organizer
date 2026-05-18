#!/usr/bin/env bash
#
# Build and bundle Organizer for Linux. Produces an AppImage and a .deb under
# src-tauri/target/release/bundle/.
#
# Run from the project root or from any subdirectory — this script jumps to
# the repo root automatically.
#
set -euo pipefail

if [ "$(uname -s)" != "Linux" ]; then
  echo "ERROR: this script must run on Linux (current: $(uname -s))." >&2
  echo "For macOS, use scripts/package-macos.sh on a Mac." >&2
  exit 1
fi

# Move to repo root (parent of scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

# Sanity check toolchain.
for cmd in pnpm cargo; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: '${cmd}' not found in PATH." >&2
    exit 1
  fi
done

echo "→ Installing JS dependencies (if needed)..."
pnpm install --frozen-lockfile

echo "→ Building release bundles (this takes a few minutes on a clean build)..."
pnpm tauri:build

BUNDLE_DIR="src-tauri/target/release/bundle"
echo
echo "✓ Build complete. Artifacts:"
find "${BUNDLE_DIR}/appimage" -maxdepth 1 -name '*.AppImage' 2>/dev/null \
  | while read -r f; do printf '  %s  (%s)\n' "${f}" "$(du -h "${f}" | cut -f1)"; done
find "${BUNDLE_DIR}/deb" -maxdepth 1 -name '*.deb' 2>/dev/null \
  | while read -r f; do printf '  %s  (%s)\n' "${f}" "$(du -h "${f}" | cut -f1)"; done
