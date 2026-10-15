#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Keep the Docker Compose project name aligned with package.json.
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required to read the package name." >&2
  exit 1
fi

PACKAGE_NAME="$(node -p "require('./package.json').name")"
if [[ -z "$PACKAGE_NAME" ]]; then
  echo "ERROR: package.json does not define a package name." >&2
  exit 1
fi

echo "Project name: ${PACKAGE_NAME}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required. Install Docker Desktop first." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl is required to generate a local password." >&2
  exit 1
fi

if [[ ! -f .env.keycloak ]]; then
  umask 077
  printf 'KC_BOOTSTRAP_ADMIN_USERNAME=admin\nKC_BOOTSTRAP_ADMIN_PASSWORD=%s\n' \
    "$(openssl rand -hex 32)" > .env.keycloak
  chmod 600 .env.keycloak
  echo "Created .env.keycloak with a generated local administrator password."
else
  echo "Preserving existing .env.keycloak."
fi

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  chmod 600 .env.local
  echo "Created .env.local from .env.example."
  echo "ACTION REQUIRED: Edit .env.local and configure your Archestra key and model."
else
  echo "Preserving existing .env.local."
fi

if ! grep -q "^AUTH_SECRET=" .env.local 2>/dev/null; then
  printf '\nAUTH_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env.local
  echo "Added generated AUTH_SECRET to .env.local."
fi

# Ensure environment symlinks exist for frontend and backend
mkdir -p frontend backend
ln -sf ../.env.local frontend/.env.local 2>/dev/null || true
ln -sf ../.env frontend/.env 2>/dev/null || true
ln -sf ../.env.local backend/.env.local 2>/dev/null || true
ln -sf ../.env backend/.env 2>/dev/null || true

# Synchronize Keycloak realm export with package.json name
node scripts/sync-keycloak.mjs

echo
echo "Setup preparation complete."
echo "Next: configure .env.local, then run: docker compose config"
