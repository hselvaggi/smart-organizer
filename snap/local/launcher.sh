#!/bin/bash
# Snap-only launcher. Sets WebKitGTK env vars right before exec so that
# nothing in the snap launch chain can scrub them — the env: block in
# snapcraft.yaml silently drops WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS
# (likely because of the "DANGEROUS" substring), and without it the
# WebProcess never paints and the window shows up as a gray rectangle.
export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
exec "$SNAP/bin/smart-organizer" "$@"
