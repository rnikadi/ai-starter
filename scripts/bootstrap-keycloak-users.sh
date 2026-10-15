#!/usr/bin/env bash
set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="ai-starter"
CLIENT_ID="ai-starter-web"
KCADM="/opt/keycloak/bin/kcadm.sh"

if [[ ! -f ".env.keycloak" ]]; then
  echo "ERROR: .env.keycloak was not found." >&2
  exit 1
fi

set -a
source ".env.keycloak"
set +a

ADMIN_USER="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-}"

if [[ -z "$ADMIN_PASSWORD" ]]; then
  echo "ERROR: Keycloak administrator password is not configured." >&2
  exit 1
fi

kc_exec() {
  docker compose exec -T keycloak "$@"
}

echo "Waiting for Keycloak..."
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
  echo "ERROR: Keycloak did not become ready." >&2
  exit 1
fi

kc_exec "$KCADM" config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$ADMIN_USER" \
  --password "$ADMIN_PASSWORD" >/dev/null

DISPLAY_NAME="$(node -p '
  require("./package.json").name
    .split(/[-_]/)
    .filter(Boolean)
    .map(p => p.toLowerCase() === "ai" ? "AI" : p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
')"

echo "Updating Keycloak realm display name to \"${DISPLAY_NAME}\"..."
kc_exec "$KCADM" update "realms/${REALM}" \
  -s "displayName=${DISPLAY_NAME}" \
  >/dev/null

echo "Looking up OIDC client..."

CLIENT_JSON="$(
  kc_exec "$KCADM" get clients \
    -r "$REALM" -q "clientId=${CLIENT_ID}"
)"

CLIENT_UUID="$(
  printf '%s' "$CLIENT_JSON" |
    node -e '
      let input = "";
      process.stdin.on("data", c => input += c);
      process.stdin.on("end", () => {
        const clients = JSON.parse(input);
        const client = clients.find(c => c.clientId === "ai-starter-web");
        if (!client) {
          console.error("OIDC client ai-starter-web was not found.");
          process.exit(1);
        }
        process.stdout.write(client.id);
      });
    '
)"

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"

kc_exec "$KCADM" update "clients/${CLIENT_UUID}" \
  -r "$REALM" \
  -s "redirectUris=[\"${FRONTEND_URL}/*\",\"http://localhost:3001/*\",\"http://127.0.0.1:3001/*\"]" \
  -s "webOrigins=[\"${FRONTEND_URL}\",\"http://localhost:3001\",\"http://127.0.0.1:3001\",\"+\"]" \
  -s "attributes={\"pkce.code.challenge.method\":\"S256\",\"post.logout.redirect.uris\":\"${FRONTEND_URL}/*##http://localhost:3001/*##http://127.0.0.1:3001/*##+\"}" \
  >/dev/null

CLIENT_JSON="$(
  kc_exec "$KCADM" get "clients/${CLIENT_UUID}" -r "$REALM"
)"

printf '%s' "$CLIENT_JSON" |
  node -e '
    let input = "";
    process.stdin.on("data", c => input += c);
    process.stdin.on("end", () => {
      const c = JSON.parse(input);
      const valid =
        c.enabled === true &&
        (c.redirectUris || []).includes("http://localhost:3001/*") &&
        (c.webOrigins || []).includes("http://localhost:3001") &&
        Boolean(c.attributes?.["post.logout.redirect.uris"]?.includes("http://localhost:3001/*"));

      if (!valid) {
        console.error("ERROR: Keycloak client redirect configuration is incomplete.");
        process.exit(1);
      }

      console.log("OIDC login and logout redirect configuration verified.");
    });
  '

ensure_user() {
  local username="$1"
  local password="$2"
  local role="$3"
  local user_json
  local user_id

  user_json="$(
    kc_exec "$KCADM" get users \
      -r "$REALM" -q "username=${username}"
  )"

  user_id="$(
    printf '%s' "$user_json" |
      USERNAME="$username" node -e '
        let input = "";
        process.stdin.on("data", c => input += c);
        process.stdin.on("end", () => {
          const users = JSON.parse(input);
          const user = users.find(u => u.username?.toLowerCase() === process.env.USERNAME.toLowerCase());
          if (user) process.stdout.write(user.id);
        });
      '
  )"

  if [[ -z "$user_id" ]]; then
    echo "Creating demo user: ${username}"

    kc_exec "$KCADM" create users \
      -r "$REALM" \
      -s "username=${username}" \
      -s enabled=true \
      >/dev/null
  else
    echo "Found existing demo user: ${username}"
  fi

  user_json="$(
    kc_exec "$KCADM" get users \
      -r "$REALM" -q "username=${username}"
  )"

  user_id="$(
    printf '%s' "$user_json" |
      USERNAME="$username" node -e '
        let input = "";
        process.stdin.on("data", c => input += c);
        process.stdin.on("end", () => {
          const users = JSON.parse(input);
          const user = users.find(u => u.username?.toLowerCase() === process.env.USERNAME.toLowerCase());
          if (user) process.stdout.write(user.id);
        });
      '
  )"

  if [[ -z "$user_id" ]]; then
    echo "ERROR: Could not retrieve the ID for ${username}." >&2
    exit 1
  fi

  kc_exec "$KCADM" set-password \
    -r "$REALM" \
    --username "$username" \
    --new-password "$password" \
    >/dev/null

  kc_exec "$KCADM" update "users/${user_id}" \
    -r "$REALM" \
    -s enabled=true \
    >/dev/null

  user_json="$(
    kc_exec "$KCADM" get users \
      -r "$REALM" -q "username=${username}"
  )"

  printf '%s' "$user_json" |
    USERNAME="$username" node -e '
      let input = "";
      process.stdin.on("data", c => input += c);
      process.stdin.on("end", () => {
        const users = JSON.parse(input);
        const user = users.find(u => u.username?.toLowerCase() === process.env.USERNAME.toLowerCase());
        if (!user) {
          console.error("ERROR: User lookup failed.");
          process.exit(1);
        }

        const actions = user.requiredActions || [];
        if (actions.includes("UPDATE_PASSWORD")) {
          console.error(
            "ERROR: UPDATE_PASSWORD is assigned to " + user.username +
            ". Remove that action without changing other required actions."
          );
          process.exit(2);
        }
      });
    '

  if ! kc_exec "$KCADM" get-roles \
    -r "$REALM" --uusername "$username" 2>/dev/null |
    grep -q "\"name\"[[:space:]]*:[[:space:]]*\"${role}\""; then
    kc_exec "$KCADM" add-roles \
      -r "$REALM" \
      --uusername "$username" \
      --rolename "$role" \
      >/dev/null
  fi

  echo "Configured ${username} (role: ${role}; default development password set)."
}

ensure_user "developer" "password" "developer"
ensure_user "viewer" "password" "viewer"

echo
echo "Keycloak bootstrap completed successfully."
echo "Login and logout redirect configuration verified."
echo "No containers, volumes, or realms were recreated."
