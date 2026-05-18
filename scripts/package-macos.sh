#!/usr/bin/env bash
#
# Build and bundle Organizer for macOS. Produces a .dmg and a .app bundle
# under src-tauri/target/release/bundle/.
#
# IMPORTANT: macOS bundles must be built on a Mac. There is no practical
# cross-compilation path from Linux/Windows for the .app + DMG (no codesign,
# no Apple SDKs). To produce a macOS build from a non-Mac host, set up a
# GitHub Actions workflow using tauri-apps/tauri-action with a macos-14
# runner.
#
# Usage:
#   ./scripts/package-macos.sh                       # native build for the
#                                                    # host arch
#   ./scripts/package-macos.sh universal             # universal x86_64 +
#                                                    # arm64 binary
#
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "ERROR: this script must run on macOS (current: $(uname -s))." >&2
  echo "To build for macOS from another OS, use GitHub Actions with a Mac" >&2
  echo "runner — for example tauri-apps/tauri-action on macos-14." >&2
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

TARGET_ARG=()
case "${1:-}" in
  universal)
    echo "→ Ensuring both Rust targets are installed..."
    rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
    TARGET_ARG=(--target universal-apple-darwin)
    ;;
  "")
    ;;
  *)
    echo "ERROR: unknown argument '$1' (expected 'universal' or none)." >&2
    exit 1
    ;;
esac

echo "→ Installing JS dependencies (if needed)..."
pnpm install --frozen-lockfile

echo "→ Building release bundles (this takes a few minutes on a clean build)..."
pnpm tauri build "${TARGET_ARG[@]}"

BUNDLE_DIR="src-tauri/target/release/bundle"
if [ ${#TARGET_ARG[@]} -gt 0 ]; then
  BUNDLE_DIR="src-tauri/target/universal-apple-darwin/release/bundle"
fi

echo
echo "✓ Build complete. Artifacts:"
find "${BUNDLE_DIR}/dmg" -maxdepth 1 -name '*.dmg' 2>/dev/null \
  | while read -r f; do printf '  %s  (%s)\n' "${f}" "$(du -h "${f}" | cut -f1)"; done
find "${BUNDLE_DIR}/macos" -maxdepth 1 -name '*.app' 2>/dev/null \
  | while read -r f; do printf '  %s  (%s)\n' "${f}" "$(du -sh "${f}" | cut -f1)"; done

echo
echo "Note: for distribution outside your Mac you will want to sign the .app"
echo "      with an Apple Developer ID and notarize it. See the Tauri docs."
