#!/usr/bin/env bash
# Called automatically by `yarn version` lifecycle hook.
# Syncs the version from package.json to tauri.conf.json and Cargo.toml.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NEW=$(jq -r .version "$ROOT/package.json")

# tauri.conf.json
jq --arg v "$NEW" '.version = $v' "$ROOT/src-tauri/tauri.conf.json" > "$ROOT/src-tauri/tauri.conf.json.tmp"
mv "$ROOT/src-tauri/tauri.conf.json.tmp" "$ROOT/src-tauri/tauri.conf.json"

# Cargo.toml (top-level package version)
sed -i '' -E "s/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"$NEW\"/" "$ROOT/src-tauri/Cargo.toml"

# Cargo.lock
cd "$ROOT/src-tauri"
cargo generate-lockfile --quiet 2>/dev/null || true

# Stage the synced files so they're included in the version commit
git add "$ROOT/src-tauri/tauri.conf.json" "$ROOT/src-tauri/Cargo.toml" "$ROOT/src-tauri/Cargo.lock"

echo "Synced version $NEW to tauri.conf.json and Cargo.toml"
