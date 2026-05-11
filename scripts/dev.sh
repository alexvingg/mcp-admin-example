#!/usr/bin/env bash
# scripts/dev.sh — sobe o stack inteiro com hot-reload.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "→ docker compose up --build"
exec docker compose up --build
