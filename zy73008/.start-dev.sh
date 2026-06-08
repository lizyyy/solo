#!/bin/zsh
set -e
cd /Users/maca/pro/solo/workspaces/zy73008
export PATH="/Users/maca/pro/solo/workspaces/zy73008/.pnpm-standalone:/Applications/Codex.app/Contents/Resources:$PATH"
NODE_BIN="/Applications/Codex.app/Contents/Resources/node"
PNPM_CJS="/Users/maca/pro/solo/workspaces/zy73008/.pnpm-standalone/package/bin/pnpm.cjs"
echo "Starting dev server..."
exec "$NODE_BIN" "$PNPM_CJS" run dev --host 0.0.0.0 --port 5173
