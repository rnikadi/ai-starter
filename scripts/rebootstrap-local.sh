#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_NAME="ai-starter"
REALM="ai-starter"
KEYCLOAK_URL="http://localhost:8080"
ARCHestra_URL="http://localhost:3000"

VOLUMES=(
  "ai-starter-keycloak-data"
  "ai-starter-postgres-data"
  "ai-starter-app-data"
)

printf '\n========== Local Environment Rebootstrap ==========\n'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "$ROOT_DIR/package.json" || ! -f "$ROOT_DIR/docker-compose.yaml" ]]; then
  printf 'ERROR: Unexpected repository directory: %s\n' "$ROOT_DIR" >&2
  printf 'Could not find package.json and docker-compose.yaml in the project root.\n' >&2
  exit 1
fi

cd "$ROOT_DIR"

for required_file in \
  docker-compose.yaml \
  scripts/bootstrap-keycloak-admin.sh \
  scripts/bootstrap-keycloak-users.sh \
  .env.keycloak
do
  if [[ ! -f "$required_file" ]]; then
    printf 'ERROR: Required file is missing: %s\n' "$required_file" >&2
    exit 1
  fi
done

if ! command -v docker >/dev/null 2>&1; then
  printf 'ERROR: Docker is not installed or is not on PATH.\n' >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'ERROR: Node.js is required for role verification.\n' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf 'ERROR: Docker is not running or is inaccessible.\n' >&2
  exit 1
fi

printf '\nRepository: %s\n' "$ROOT_DIR"
printf 'Compose project: %s\n' "$PROJECT_NAME"
printf '\nThis operation will permanently delete these volumes:\n'

for volume in "${VOLUMES[@]}"; do
  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    printf 'ERROR: Expected volume does not exist: %s\n' "$volume" >&2
    printf 'No reset has been performed by this script.\n' >&2
    exit 1
  fi

  project_label="$(
    docker volume inspect \
      --format '{{index .Labels "com.docker.compose.project"}}' \
      "$volume"
  )"

  case "$volume" in
    ai-starter-keycloak-data) expected_label="keycloak-data" ;;
    ai-starter-postgres-data) expected_label="postgres-data" ;;
    ai-starter-app-data) expected_label="app-data" ;;
    *)
      printf 'ERROR: Unrecognized volume: %s\n' "$volume" >&2
      exit 1
      ;;
  esac

  volume_label="$(
    docker volume inspect \
      --format '{{index .Labels "com.docker.compose.volume"}}' \
      "$volume"
  )"

  if [[ "$project_label" != "$PROJECT_NAME" ||
        "$volume_label" != "$expected_label" ]]; then
    printf 'ERROR: Volume ownership validation failed for %s.\n' "$volume" >&2
    printf 'No reset has been performed by this script.\n' >&2
    exit 1
  fi

  printf '  - %s\n' "$volume"
done

printf '\nSource files and environment files will be preserved.\n'
printf 'Archestra provider configuration and Keycloak database data will be erased.\n'
printf 'OpenRouter provider setup may need to be repeated afterward.\n'

printf '\nTo confirm, type exactly: RESET\n'
printf '> '

IFS= read -r confirmation

if [[ "$confirmation" != "RESET" ]]; then
  printf 'Cancelled. No data was deleted.\n'
  exit 0
fi

printf '\n========== Stopping services ==========\n'
docker compose down

printf '\n========== Removing verified project volumes ==========\n'
docker volume rm "${VOLUMES[@]}"

printf '\n========== Starting fresh services ==========\n'
docker compose up -d

printf '\n========== Waiting for Keycloak ==========\n'

keycloak_ready=false

for attempt in $(seq 1 120); do
  if curl --silent --show-error --fail \
    --max-time 3 \
    "$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration" \
    -o /dev/null 2>/dev/null; then
    keycloak_ready=true
    break
  fi

  sleep 2
done

if [[ "$keycloak_ready" != true ]]; then
  printf 'ERROR: Keycloak did not become ready within 240 seconds.\n' >&2
  docker compose ps
  printf '\nInspect logs with: docker compose logs --tail=100 keycloak\n'
  exit 1
fi

printf 'Keycloak is responding.\n'

printf '\n========== Waiting for healthy Archestra ==========\n'

archestra_ready=false

for attempt in $(seq 1 120); do
  if ! docker inspect archestra >/dev/null 2>&1; then
    sleep 2
    continue
  fi

  container_state="$(
    docker inspect \
      --format '{{.State.Status}}' \
      archestra
  )"

  health_state="$(
    docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' \
      archestra
  )"

  if [[ "$container_state" == "running" &&
        "$health_state" == "healthy" ]]; then
    archestra_ready=true
    break
  fi

  sleep 2
done

if [[ "$archestra_ready" != true ]]; then
  printf 'ERROR: Archestra did not become healthy within 240 seconds.\n' >&2
  docker compose ps
  printf '\nInspect logs with: docker compose logs --tail=100 archestra\n'
  exit 1
fi

printf 'Archestra is healthy.\n'

printf '\n========== Bootstrapping Keycloak admin ==========\n'
./scripts/bootstrap-keycloak-admin.sh

printf '\n========== Bootstrapping developer and viewer ==========\n'
./scripts/bootstrap-keycloak-users.sh

verify_role() {
  local username="$1"
  local expected_role="$2"
  local roles_json

  roles_json="$(
    docker exec keycloak /opt/keycloak/bin/kcadm.sh get-roles \
      -r "$REALM" \
      --uusername "$username"
  )" || return 1

  if ! printf '%s' "$roles_json" |
    EXPECTED_ROLE="$expected_role" node -e '
      let input = "";
      process.stdin.on("data", chunk => input += chunk);
      process.stdin.on("end", () => {
        try {
          const roles = JSON.parse(input);
          const found = roles.some(
            role => role.name === process.env.EXPECTED_ROLE
          );
          process.exit(found ? 0 : 1);
        } catch {
          process.exit(2);
        }
      });
    '
  then
    printf 'ERROR: Expected role %s was not verified for %s.\n' \
      "$expected_role" "$username" >&2
    return 1
  fi

  printf 'PASS: %s has role %s\n' "$username" "$expected_role"
}

printf '\n========== Verifying role assignments ==========\n'
verify_role "Admin" "admin"
verify_role "Developer" "developer"
verify_role "Viewer" "viewer"

printf '\n========== Final service status ==========\n'
docker compose ps

printf '\n========== Rebootstrap completed successfully ==========\n'
printf 'Keycloak:       %s\n' "$KEYCLOAK_URL"
printf 'Archestra UI:   %s\n' "$ARCHestra_URL"
printf 'Archestra proxy: http://localhost:9000\n'
printf 'Next.js:        not started by this script\n'
printf '\nNext step: run pnpm dev in a separate terminal.\n'
