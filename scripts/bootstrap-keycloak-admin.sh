#!/usr/bin/env bash
set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="ai-starter"
USERNAME="admin"
STARTER_ADMIN_PASSWORD="${STARTER_ADMIN_PASSWORD:-password}"
KCADM="/opt/keycloak/bin/kcadm.sh"

if [[ ! -f ".env.keycloak" ]]; then
  printf 'ERROR: .env.keycloak was not found.\n' >&2
  exit 1
fi

set -a
source ".env.keycloak"
set +a

ADMIN_USER="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-}"

if [[ -z "$ADMIN_PASSWORD" ]]; then
  printf 'ERROR: Keycloak bootstrap administrator password is not configured.\n' >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'ERROR: Docker CLI was not found.\n' >&2
  exit 1
fi

if ! docker inspect keycloak >/dev/null 2>&1; then
  printf 'ERROR: A container named keycloak was not found.\n' >&2
  exit 1
fi

printf 'Waiting for Keycloak...\n'
ready=false

for attempt in $(seq 1 60); do
  if curl -fsS \
    "${KEYCLOAK_URL}/realms/${REALM}/.well-known/openid-configuration" \
    >/dev/null; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "$ready" != "true" ]]; then
  printf 'ERROR: Keycloak did not become ready.\n' >&2
  exit 1
fi

docker exec keycloak "$KCADM" config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$ADMIN_USER" \
  --password "$ADMIN_PASSWORD" \
  >/dev/null

if ! docker exec keycloak "$KCADM" get "roles/admin" \
  -r "$REALM" >/dev/null 2>&1; then
  printf 'ERROR: The admin realm role does not exist in realm %s.\n' "$REALM" >&2
  exit 1
fi

lookup_user_id() {
  local user_json

  user_json="$(
    docker exec keycloak "$KCADM" get users \
      -r "$REALM" \
      -q "username=${USERNAME}"
  )"

  printf '%s' "$user_json" |
    USERNAME="$USERNAME" node -e '
      let input = "";
      process.stdin.on("data", chunk => input += chunk);
      process.stdin.on("end", () => {
        const users = JSON.parse(input);
        const user = users.find(item => item.username?.toLowerCase() === process.env.USERNAME.toLowerCase());
        if (user) process.stdout.write(user.id);
      });
    '
}

USER_ID="$(lookup_user_id)"

if [[ -z "$USER_ID" ]]; then
  printf 'Creating local-development admin account...\n'

  docker exec keycloak "$KCADM" create users \
    -r "$REALM" \
    -s "username=${USERNAME}" \
    -s enabled=true \
    >/dev/null

  USER_ID="$(lookup_user_id)"

  if [[ -z "$USER_ID" ]]; then
    printf 'ERROR: User creation could not be verified.\n' >&2
    exit 1
  fi

  docker exec keycloak "$KCADM" set-password \
    -r "$REALM" \
    --username "$USERNAME" \
    --new-password "$STARTER_ADMIN_PASSWORD"

  printf 'Created the admin account with the documented local-development password.\n'
else
  printf 'Found existing admin account; preserving its password.\n'

  if [[ "${STARTER_ADMIN_RESET_PASSWORD:-false}" == "true" ]]; then
    docker exec keycloak "$KCADM" set-password \
      -r "$REALM" \
      --username "$USERNAME" \
      --new-password "$STARTER_ADMIN_PASSWORD"

    printf 'Admin password reset to the configured local-development password.\n'
  fi
fi

docker exec keycloak "$KCADM" update "users/${USER_ID}" \
  -r "$REALM" \
  -s enabled=true \
  >/dev/null

has_admin_role() {
  local roles_json

  roles_json="$(
    docker exec keycloak "$KCADM" get-roles \
      -r "$REALM" \
      --uusername "$USERNAME"
  )" || return 1

  printf '%s' "$roles_json" |
    ROLE_NAME="admin" node -e '
      let input = "";
      process.stdin.on("data", chunk => input += chunk);
      process.stdin.on("end", () => {
        const roles = JSON.parse(input);
        const found = roles.some(role => role.name === process.env.ROLE_NAME);
        process.exit(found ? 0 : 1);
      });
    '
}

if ! has_admin_role; then
  docker exec keycloak "$KCADM" add-roles \
    -r "$REALM" \
    --uusername "$USERNAME" \
    --rolename admin \
    >/dev/null
fi

if ! has_admin_role; then
  printf 'ERROR: Admin role assignment could not be verified.\n' >&2
  exit 1
fi

printf '\nKeycloak admin bootstrap completed.\n'
printf 'Username: %s\n' "$USERNAME"
printf 'Realm: %s\n' "$REALM"
printf 'Role: admin\n'
printf 'See README.md for local-development credentials.\n'
printf 'Existing developer/viewer accounts were not modified.\n'
