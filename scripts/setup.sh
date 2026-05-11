#!/usr/bin/env bash
# scripts/setup.sh — primeiro setup local
# Copia .env.example -> .env nos apps que ainda não têm um, e avisa o usuário.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

copy_if_missing() {
  local example="$1"
  local target="$2"

  if [[ -f "$target" ]]; then
    echo "✓ $target já existe, mantido."
  else
    cp "$example" "$target"
    echo "✓ Criado $target a partir de $example"
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup local — auth0-project-mcp"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

copy_if_missing "$ROOT_DIR/apps/admin-api/.env.example" "$ROOT_DIR/apps/admin-api/.env"
copy_if_missing "$ROOT_DIR/apps/admin-web/.env.example" "$ROOT_DIR/apps/admin-web/.env"

cat <<'EOF'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Próximos passos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Edite apps/admin-api/.env e apps/admin-web/.env com os valores do seu tenant Auth0.
     Veja docs/AUTH0_SETUP.md para o passo a passo.

  2. Suba os containers:
       docker compose up --build

  3. Acesse:
       Frontend:  http://localhost:5173
       Backend:   http://localhost:3001/api/health
       Postgres:  localhost:5432 (user=admin, password=admin, db=admindb)
EOF
