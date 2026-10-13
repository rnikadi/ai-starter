#!/usr/bin/env bash
set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"

DEVELOPER_USER="starter-developer"
DEVELOPER_PASSWORD="DevOpsDev123!"
VIEWER_USER="starter-viewer"
VIEWER_PASSWORD="DevOpsView123!"

KCADM="/opt/keycloak/bin/kcadm.sh"

echo "Waiting for Keycloak..."
for attempt in $(seq 1 60); do
  if curl -fsS \
    "${KEYCLOAK_URL}/realms/ai-starter-kit/.well-known/openid-configuration" \
    >/dev/null; then
    break
  fi

  if [ "$attempt" -eq 60 ]; then
    echo "ERROR: Keycloak did not become ready." >&2
    exit 1
  fi

  sleep 2
done

docker exec keycloak "$KCADM" config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$ADMIN_USER" \
  --password "$ADMIN_PASSWORD"

ensure_user() {
  local username="$1"
  local password="$2"
  local role="$3"

  if ! docker exec keycloak "$KCADM" get users \
    -r ai-starter-kit -q "username=${username}" 2>/dev/null |
    grep -q '"username"'; then
    docker exec keycloak "$KCADM" create users \
      -r ai-starter-kit \
      -s "username=${username}" \
      -s enabled=true
  fi

  docker exec keycloak "$KCADM" set-password \
    -r ai-starter-kit \
    --username "$username" \
    --new-password "$password"

  docker exec keycloak "$KCADM" add-roles \
    -r ai-starter-kit \
    --uusername "$username" \
    --rolename "$role"

  echo "Configured ${username} with role ${role}."
}

ensure_user "$DEVELOPER_USER" "$DEVELOPER_PASSWORD" developer
ensure_user "$VIEWER_USER" "$VIEWER_PASSWORD" viewer

echo
echo "Local Keycloak test users are ready."
echo "Developer username: ${DEVELOPER_USER}"
echo "Developer password: ${DEVELOPER_PASSWORD}"
echo "Viewer username: ${VIEWER_USER}"
echo "Viewer password: ${VIEWER_PASSWORD}"
echo
echo "These credentials are for local development only."
