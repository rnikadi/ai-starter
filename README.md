# AI Starter

A reusable, local-first starter kit for AI applications built with **Next.js, TypeScript, Mastra, Archestra, OpenRouter, and Keycloak**.

AI Starter provides a small web application, an AI integration path through an LLM gateway, local identity infrastructure, and repeatable development commands. It is a development starter—not a production-ready platform.

**Repository:** [rnikadi/ai-starter](https://github.com/rnikadi/ai-starter)

> **Current status (2026-10-13):** TypeScript, lint, and production-build checks have passed in the reported working tree. The OIDC client ID, issuer, and exported client secret have been checked for consistency. Compose project and volume names have been validated statically. Keycloak realm discovery and the developer/viewer demo-user configuration have been verified in the local runtime. Interactive browser login/logout and server-enforced RBAC still require end-to-end verification. A successful build or OIDC discovery response does not prove that the full authentication and authorization flow works.

## Contents

- [Architecture](#architecture)
- [Components and local addresses](#components-and-local-addresses)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Configure environment variables](#configure-environment-variables)
- [Start and validate infrastructure](#start-and-validate-infrastructure)
- [Keycloak and local test users](#keycloak-and-local-test-users)
- [Run the application](#run-the-application)
- [Test the AI integration](#test-the-ai-integration)
- [Platform features and architecture](#platform-features-and-architecture)
- [Observability and Grafana logging](#observability-and-grafana-logging)
- [Validation commands](#validation-commands)
- [Credentials and secrets](#credentials-and-secrets)
- [Daily Docker operations](#daily-docker-operations)
- [Troubleshooting](#troubleshooting)
- [Persistent-volume safety](#persistent-volume-safety)
- [Security and production readiness](#security-and-production-readiness)
- [Project status](#project-status)
- [Contributing](#contributing)
- [License](#license)

## Architecture

```text
Browser
  |
  v
Frontend (Next.js) :3001
  |  Auth.js / Keycloak OIDC (:8080)
  |  HTTP requests with Bearer token & x-request-id
  v
Backend (Node.js API) :4000
  |  JWT Bearer token verification & RBAC
  |  Mastra agent
  v
Archestra LLM proxy :9000
  |
  v
Configured model provider (for example, OpenRouter)

Local infrastructure & Observability:
  Archestra UI          :3000
  Keycloak              :8080
  Grafana Observability :3002
  Loki Log Aggregator   :3100
```

## Components and local addresses

| Component | Responsibility | Local address |
|---|---|---|
| **Frontend** (Next.js) | UI, Auth.js integration, client dashboard, role views | http://localhost:3001 |
| **Backend** (Node.js API) | Standalone API server, Mastra agent, JWT auth & RBAC | http://localhost:4000 |
| **Grafana Observability** | Unified visual log dashboard (Keycloak, Archestra, Backend, Frontend) | http://localhost:3002 |
| **Loki** | High-performance log aggregation engine | http://localhost:3100 |
| **API Docs & Swagger** | Interactive API documentation (self-contained, offline) | http://localhost:4000/docs |
| **OpenAPI 3.1 Spec** | Machine-readable API schema definition | http://localhost:4000/openapi.json |
| **Health Probes** | Process liveness (`/healthz`) & dependency readiness (`/readyz`) | http://localhost:4000/healthz |
| **Mastra** | Autonomous agent execution & prompt routing | Inside Backend (:4000) |
| **Archestra** | LLM gateway and model routing | http://localhost:9000 |
| **Archestra UI** | Gateway administration | http://localhost:3000 |
| **Keycloak** | OIDC identity provider and realm roles | http://localhost:8080 |
| **OpenRouter / Provider** | Model inference behind Archestra | Configured in Archestra |

The frontend and backend run as distinct services on the host machine. Infrastructure ports are bound to loopback for local development.

### Request flow

1. A browser opens the frontend application at http://localhost:3001.
2. Sign-in is delegated to Keycloak (:8080) through Auth.js.
3. The frontend captures the user's session and Access Token.
4. An authorized request (such as AI testing) calls the backend at http://localhost:4000 with the Bearer token.
5. The backend validates the token and realm roles (`developer` / `admin`).
6. The backend executes the Mastra agent, routing through Archestra (:9000) to the model provider.
7. The response returns from the backend to the frontend and browser.

Authentication and authorization behavior must be verified with real browser sessions and HTTP status checks.

## Prerequisites

Install the following tools:

- Git
- Docker Desktop with Docker Compose
- Node.js 24 or another project-supported release
- pnpm 11.25.0
- OpenSSL
- `curl`
- `jq` (optional, useful for formatted JSON output)

Check versions:

```bash
git --version
docker --version
docker compose version
node --version
pnpm --version
openssl version
curl --version
jq --version
```

Start Docker Desktop before using Compose.

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/rnikadi/ai-starter.git
cd ai-starter
```

If you already have the repository locally, run the remaining commands from its root directory.

### 2. Prepare local environment files

```bash
chmod +x setupscripts.sh
./setupscripts.sh
```

The setup script:

- Reads the package name from `package.json`.
- Creates or updates the ignored `.env` file with `COMPOSE_PROJECT_NAME`.
- Creates `.env.keycloak` with a randomly generated bootstrap administrator password if the file does not exist.
- Creates `.env.local` from `.env.example` if it does not exist.
- Preserves existing `.env.local` and `.env.keycloak` files.
- Does not stop containers, delete volumes, or migrate existing data.

If `.env.local` already exists, the setup script deliberately preserves it. It will not automatically replace existing API keys, model names, OIDC settings, or other values.

### 3. Configure `.env.local`

Open `.env.local` in your editor. **Do not paste it into chat, tickets, or logs.**

Important variables include:

| Variable | Purpose |
|---|---|
| `ARCHESTRA_BASE_URL` | Archestra OpenAI-compatible endpoint; local examples use `http://localhost:9000/v1` |
| `ARCHESTRA_VIRTUAL_KEY` | Virtual key configured in Archestra |
| `ARCHESTRA_MODEL` | Model identifier available through Archestra |
| `AUTH_KEYCLOAK_ID` | OIDC client ID; expected value is `ai-starter-web` |
| `AUTH_KEYCLOAK_ISSUER` | Expected value is `http://localhost:8080/realms/ai-starter` |
| `AUTH_KEYCLOAK_SECRET` | Must match the confidential client secret in `keycloak/realm-export.json` |

Use a model identifier and virtual key that are valid in your Archestra configuration. Do not expose these values to browser-side code or `NEXT_PUBLIC_*` variables.

To verify the non-secret naming configuration without printing secrets:

```bash
python3 - <<'PY'
import json
from pathlib import Path

def read_env(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values

env = read_env(".env.local")
realm = json.loads(Path("keycloak/realm-export.json").read_text())
client_id = env.get("AUTH_KEYCLOAK_ID")
client = next(
    (c for c in realm.get("clients", []) if c.get("clientId") == client_id),
    None,
)

checks = {
    "OIDC client exists": client is not None,
    "OIDC client secret matches": bool(
        client
        and env.get("AUTH_KEYCLOAK_SECRET")
        and env["AUTH_KEYCLOAK_SECRET"] == client.get("secret")
    ),
    "OIDC issuer matches": env.get("AUTH_KEYCLOAK_ISSUER")
    == f"http://localhost:8080/realms/{realm.get('realm')}",
}
for name, ok in checks.items():
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
if not all(checks.values()):
    raise SystemExit(1)
PY
```

This check reads the secret internally but prints only PASS/FAIL.

### 4. Configure `.env.keycloak`

Compose loads `.env.keycloak` into the Keycloak container. It contains:

```text
KC_BOOTSTRAP_ADMIN_USERNAME
KC_BOOTSTRAP_ADMIN_PASSWORD
```

Keep this file private. Bootstrap variables initialize an administrator on a fresh Keycloak data store; changing the variables does not reset an administrator password in an already-initialized database.

### 5. Keep secrets out of Git

Do not commit:

```text
.env
.env.local
.env.keycloak
```

The tracked examples are `.env.example` and `.env.keycloak.example`. Never commit passwords, OIDC client secrets, virtual keys, access tokens, or other credentials. Check `.gitignore` before adding configuration files.

## Start and validate infrastructure

### Validate Compose configuration

These checks validate configuration without starting services:

```bash
./setupscripts.sh
docker compose config --quiet
docker compose config --format json | python3 -c '
import json, sys
config = json.load(sys.stdin)
print("Compose project:", config["name"])
for logical, volume in config.get("volumes", {}).items():
    print("{}: {}".format(logical, volume.get("name", logical)))
'
docker compose config --services
```

Expected Compose project: `ai-starter`.

Expected services: `archestra`, `keycloak`.

Expected volumes:

```text
postgres-data -> ai-starter-postgres-data
app-data -> ai-starter-app-data
keycloak-data -> ai-starter-keycloak-data
```

The named volumes are created when the new Compose project starts. A successful `docker compose config` only validates configuration; it does not prove that services can start or that their data is correct.

### Start infrastructure

```bash
docker compose up -d
docker compose ps
```

Follow initialization logs in separate terminals if needed:

```bash
docker compose logs -f keycloak
```

```bash
docker compose logs -f archestra
```

The first startup can take time. Wait for Keycloak to finish initialization and for Archestra to become healthy before testing the application.

### Open the local UIs

- Archestra: http://localhost:3000
- Keycloak admin console: http://localhost:8080/admin/
- Next.js application (after starting it): http://localhost:3001

## Keycloak and local test users

The realm export is `keycloak/realm-export.json`.

| Setting | Value |
|---|---|
| Realm | `ai-starter` |
| OIDC client | `ai-starter-web` |
| Client type | Confidential |
| Standard flow | Enabled |
| PKCE | `S256` |
| Redirect URI | `http://localhost:3001/*` |
| Web origin | `http://localhost:3001` |

The realm export defines these realm roles:

| Role | Intended purpose |
|---|---|
| `viewer` | Read-only application capabilities |
| `developer` | AI and development capabilities |
| `admin` | Administrative application capabilities |

The realm export includes a realm-role mapper intended to expose roles through `realm_access.roles`.

### Check Keycloak discovery

```bash
curl --fail --silent --show-error \
  http://localhost:8080/realms/ai-starter/.well-known/openid-configuration \
  | jq '{issuer, authorization_endpoint, token_endpoint, jwks_uri}'
```

Expected issuer:

```text
http://localhost:8080/realms/ai-starter
```

### Local test accounts and credentials

The repository provides automated bootstrap scripts to provision local development accounts in the `ai-starter` realm:

| Account | Username | Default Password | Realm Role | Bootstrap Script |
|---|---|---|---|---|
| **Administrator** | `Admin` | `password` | `admin` | `./scripts/bootstrap-keycloak-admin.sh` |
| **Developer** | `developer` | `password` | `developer` | `./scripts/bootstrap-keycloak-users.sh` |
| **Viewer** | `viewer` | `password` | `viewer` | `./scripts/bootstrap-keycloak-users.sh` |

> [!WARNING]
> These credentials are intended exclusively for local development and demonstration. Never use them in staging or production environments.

### Provision local test users

1. **Bootstrap developer and viewer accounts**:
   ```bash
   ./scripts/bootstrap-keycloak-users.sh
   ```

2. **Bootstrap administrator account**:
   ```bash
   ./scripts/bootstrap-keycloak-admin.sh
   ```
   If the `Admin` account already exists, the script preserves its existing password. To explicitly reset the `Admin` password:
   ```bash
   STARTER_ADMIN_RESET_PASSWORD=true ./scripts/bootstrap-keycloak-admin.sh
   # Or with a custom local password:
   STARTER_ADMIN_RESET_PASSWORD=true \
   STARTER_ADMIN_PASSWORD='Replace-With-Your-Own-Local-Password' \
   ./scripts/bootstrap-keycloak-admin.sh
   ```

Both scripts use Keycloak's `kcadm.sh` inside the `keycloak` container and expect administrator credentials matching the initialized Keycloak database. If authentication fails, do not reset volumes; verify which administrator was initialized in `.env.keycloak`.

For browser verification:

1. Open http://localhost:3001.
2. Select **Sign in with Keycloak**.
3. Sign in as the `developer` user.
4. Confirm the application returns to the local workspace, displays the `developer` role, and allows AI connectivity testing.
5. Sign out and repeat with the `viewer` user; confirm AI testing is restricted.
6. Sign out and repeat with `Admin`; confirm the **Admin console** link is visible, and verify access to http://localhost:3001/admin and http://localhost:3001/api/admin/status.
7. Verify anonymous and viewer API requests return the status codes enforced by the current API routes (401 / 403).

## Run the application

Install dependencies:

```bash
pnpm install
```

### Development Modes

AI Starter supports two distinct development modes:

#### Mode 1: Host Development (Fastest, hot-reloading)

Recommended for active day-to-day code editing:

```bash
# Starts Keycloak (:8080) & Archestra (:9000/:3000) in Docker,
# and runs Backend (:4000) + Frontend (:3001) concurrently on the host with hot-reloading:
pnpm dev

# Stop Docker infrastructure when done
pnpm dev:down

# Other options:
pnpm dev:app       # Starts backend and frontend only (skips Docker check/startup)
pnpm dev:backend   # Starts the backend API server alone on http://localhost:4000
pnpm dev:frontend  # Starts the Next.js frontend alone on http://localhost:3001
```

> **How `pnpm dev` works:**
> 1. Verifies Docker Desktop is running and automatically executes `docker compose up -d` to ensure Keycloak (:8080) and Archestra (:9000/:3000) are running.
> 2. Displays the service dashboard with ports and URLs.
> 3. Spawns the Backend (:4000) and Frontend (:3001) concurrently in the foreground.
> 4. Pressing `Ctrl+C` cleanly terminates the host development servers while keeping Docker containers running. When you want to stop the Docker containers, run `pnpm dev:down`.

#### Mode 2: Full Containerized Demo & Observability (Grafana + Loki)

Recommended for stakeholder demos, presentations, or testing production Docker images:

```bash
# Builds and starts all 7 containers:
# Frontend (:3001), Backend (:4000), Keycloak (:8080), Archestra (:9000/:3000),
# Grafana (:3002), Loki (:3100), and Promtail
pnpm docker:demo

# Open Grafana to inspect live visual logs across all 4 services
open http://localhost:3002  # Default login: admin / admin

# Check container status
pnpm docker:status

# Stop all demo containers when done
pnpm docker:down
```

#### Optional: Standalone Observability with Host Dev

If you are developing locally with `pnpm dev` and want to spin up Grafana & Loki to visualize logs from Keycloak and Archestra:

```bash
pnpm monitoring:up     # Starts Loki (:3100), Promtail, and Grafana (:3002)
pnpm monitoring:down   # Stops monitoring containers
```

## Test the AI integration

The integration test is `scripts/test-archestra.ts` and is invoked by:

```bash
pnpm test:archestra
```

It requires:

- Docker Desktop running.
- Archestra reachable.
- `.env.local` configured with a valid Archestra endpoint, virtual key, and model.
- The model connection configured and usable in Archestra.

Expected successful marker:

```text
MASTRA_ARCHESTRA_CONNECTION_SUCCESS
```

This test exercises the Mastra-to-Archestra path. It does not, by itself, prove browser authentication or RBAC.

### Test the Next.js AI API

The current endpoint is `POST /api/ai/test`.

```bash
curl --fail-with-body --silent --show-error --max-time 120 \
  http://localhost:3001/api/ai/test \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Reply with exactly: NEXTJS_MASTRA_ARCHESTRA_SUCCESS"}'
```

The API may require a valid session and an authorized role. If an anonymous call is rejected, sign in through the browser and use an authenticated browser session for authorized testing. Check the route's current behavior rather than assuming a specific HTTP status.

## Platform features and architecture

AI Starter provides production-grade backend plumbing designed to remain generic and unopinionated so developers can build their own custom business logic and UI without clean-up overhead:

### 1. Structured logging and correlation IDs
- All requests are tagged with a unique `x-request-id` (UUID).
- Incoming `x-request-id` headers from browsers or reverse proxies are preserved and propagated from the Next.js frontend proxy to the backend API.
- Configurable output format (`LOG_FORMAT=pretty` for colored human-readable development output; `LOG_FORMAT=json` for JSON production output).
- Configurable log levels (`LOG_LEVEL=debug|info|warn|error`).

### 2. Standardized health and readiness probes
- **`GET /healthz`** (Liveness probe): Returns process status, uptime, Node version, and memory usage statistics.
- **`GET /readyz`** (Readiness probe): Verifies downstream dependencies (Keycloak OIDC discovery and Archestra LLM gateway). Returns `200 OK` when ready or `503 Service Unavailable` with details if a dependency fails.
- Frontend exposes `/api/healthz` and `/api/readyz` checking backend availability.

### 3. Fail-fast environment validation (Zod)
- Environment variables are validated on server startup using strict Zod schemas (`backend/src/config/env.ts` and `frontend/src/lib/env.ts`).
- Missing or malformed configurations trigger clear, descriptive error messages on boot rather than failing unexpectedly during runtime.

### 4. Pluggable RBAC route guards
- Reusable, declarative middleware functions in `backend/src/middleware/rbac.ts`:
  - `guardAuth(req, res)`: Enforces JWT Bearer or forwarded session authentication.
  - `guardRoles(res, user, allowedRoles)`: Enforces realm roles (`viewer`, `developer`, `admin`).
  - Helper predicates: `hasRole()`, `hasAnyRole()`, `hasAllRoles()`.

### 5. API rate limiting and protection
- In-memory sliding window rate limiter in `backend/src/middleware/rate-limit.ts`.
- Preconfigured rate limiters:
  - `apiRateLimiter`: 120 req/min for general API routes.
  - `aiRateLimiter`: 20 req/min for LLM generation routes to prevent quota exhaustion.
- Enforces standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

### 6. OpenAPI 3.1 specification and offline documentation
- **`GET /openapi.json`**: Complete, machine-readable OpenAPI 3.1 specification.
- **`GET /docs`**: Interactive, dark-mode API documentation viewer. Self-contained with zero external CDN dependencies—works 100% offline.

### 7. Offline mock AI mode (`MOCK_AI=true`)
- Set `MOCK_AI=true` in `.env.local` to develop and test without running Archestra or requiring external OpenRouter API keys.
- Returns instant simulated agent responses marked with `[MOCK AI MODE]`.

### 8. Automated CI workflow
- `.github/workflows/ci.yml` runs automated tests, typechecks, linting, and production builds on push and pull requests.

## Observability and Grafana logging

AI Starter includes a centralized, visual observability stack powered by **Grafana, Loki, and Promtail**. It collects and streams live logs from all running services into a single, searchable dashboard.

### 1. Accessing Grafana

- **URL:** [http://localhost:3002](http://localhost:3002)
- **Default credentials:**
  - **Username:** `admin`
  - **Password:** `admin`
- **Default Datasource:** Grafana Loki (`http://loki:3100`) is pre-provisioned automatically.
- **Pre-loaded Dashboard:** Open **Dashboards** &rarr; **AI Starter** &rarr; **Application Logs Overview**.

### 2. Log Ingestion Architecture

```text
Docker Containers (stdout/stderr)
  ├── keycloak   (OIDC authentications, realm events, tokens)
  ├── archestra  (LLM proxy requests, upstream model inference)
  ├── backend    (Mastra agents, structured JSON logs, RBAC)
  └── frontend   (Next.js SSR, Auth.js session handlers, BFF)
        │
        ▼
   Promtail (Scrapes /var/run/docker.sock, extracts labels)
        │
        ▼
   Grafana Loki (:3100) (Indexes logs by service, level, reqId)
        │
        ▼
   Grafana Dashboard (:3002) (Interactive log stream & visual metrics)
```

### 3. LogQL Querying & Search Examples

In Grafana **Explore** (`http://localhost:3002/explore`), choose **Loki** as the datasource and try these queries:

| Use Case | LogQL Query |
|---|---|
| **View Keycloak logs** | `{service="keycloak"}` |
| **View Archestra LLM gateway logs** | `{service="archestra"}` |
| **View Backend API logs** | `{service="backend"}` |
| **View Frontend Next.js logs** | `{service="frontend"}` |
| **Trace a request across all services** | `{service=~".*"} \|= "YOUR_X_REQUEST_ID"` |
| **Filter all errors across all containers** | `{service=~".*"} \|~ "(?i)(error\|fatal\|fail\|exception)"` |
| **Parse backend structured JSON fields** | `{service="backend"} \| json \| statusCode >= 400` |

### 4. Zero Overlap Guarantee

The observability system is purely **read-only and non-intrusive**:
- **Keycloak** remains the single authority for user accounts and OIDC authentication. Grafana simply streams Keycloak's server logs.
- **Archestra** remains the single authority for model proxying and virtual keys. Grafana simply streams Archestra's traffic logs.
- **No custom logging libraries** or invasive agents are added to the core application—services log to standard output (`stdout`), and Promtail captures them automatically.

### 5. Starting the Observability Stack

You can launch Grafana in two ways:

1. **Full Containerized Demo:**
   ```bash
   pnpm docker:demo      # Boots Frontend, Backend, Keycloak, Archestra, Loki, and Grafana
   pnpm docker:down      # Stops all demo containers
   ```

2. **Standalone Observability with Local Host Dev:**
   ```bash
   pnpm dev              # Runs your host app on :3001 and :4000
   pnpm monitoring:up    # In another terminal: launches Loki, Promtail, and Grafana (:3002)
   pnpm monitoring:down  # Stops monitoring containers
   ```

## Validation commands

Run before submitting changes:

```bash
# TypeScript
pnpm exec tsc --noEmit

# ESLint
pnpm lint

# Production build
pnpm build

# Docker Compose configuration
docker compose config --quiet

# Validate realm JSON
python3 -m json.tool keycloak/realm-export.json >/dev/null

# Validate shell scripts
bash -n setupscripts.sh
bash -n scripts/bootstrap-keycloak-users.sh

# Whitespace and patch check
git diff --check
```

## Credentials and secrets

> **Warning — local development credentials only.** The credentials and procedures in this section are intended only for a disposable local development environment. Change passwords, secrets, and API keys before sharing the project, publishing a repository, or deploying anywhere outside your own machine. Never commit `.env`, `.env.local`, `.env.keycloak`, access tokens, Archestra virtual keys, or real passwords. The demo passwords below are not secure defaults for shared environments.

This starter kit uses separate credentials for infrastructure administration, AI gateway access, and application users. These are not interchangeable.

| Service/account | Username or identifier | Password/secret source |
|---|---|---|
| Keycloak bootstrap administrator | `KC_BOOTSTRAP_ADMIN_USERNAME` (the setup script initially uses `admin`) | `KC_BOOTSTRAP_ADMIN_PASSWORD` in local `.env.keycloak` |
| Application OIDC client | `ai-starter-web` | Client secret in `keycloak/realm-export.json`, matched by `AUTH_KEYCLOAK_SECRET` in `.env.local` |
| Application developer test user | `Developer` | Current bootstrap script sets `password` |
| Application viewer test user | `Viewer` | Current bootstrap script sets `password` |
| Application admin role | No built-in admin user is provisioned by the demo bootstrap script | Create a dedicated user, assign the `admin` realm role, and set a unique password |
| Archestra administration | No universal default is defined by this repository | Use the administrator account configured for the running Archestra instance |
| Archestra model gateway | Virtual key configured in Archestra | `ARCHESTRA_VIRTUAL_KEY` in `.env.local` |
| Model provider (for example, OpenRouter) | Provider-specific account/API key | Configure the provider credential in Archestra |

The repository does not define a universal Archestra username/password. Do not assume `admin/admin` or reuse Keycloak credentials for Archestra.

### Current local test-user credentials

The current `scripts/bootstrap-keycloak-users.sh` script contains these local-only test accounts:

| Application user | Realm | Role | Current script password |
|---|---|---|---|
| `Developer` | `ai-starter` | `developer` | `password` |
| `Viewer` | `ai-starter` | `viewer` | `password` |

These are generic local demo credentials, not secure defaults. Change them before sharing the repository or using it in any shared environment. The bootstrap script does not currently provision an application user with the `admin` realm role.

The application uses Keycloak for sign-in. Application test users are Keycloak realm users; they are not stored as separate usernames/passwords in Next.js.

### Change the developer and viewer test passwords

1. Open `scripts/bootstrap-keycloak-users.sh`.
2. Change the passwords to the local values you want.
3. Do not use production or reused passwords in this script.
4. Start Keycloak and verify that the `ai-starter` realm is available.
5. Run the script to apply the configured users/passwords and role assignments:

   ```bash
   bash -n scripts/bootstrap-keycloak-users.sh
   bash scripts/bootstrap-keycloak-users.sh
   ```

6. Sign in to the application at http://localhost:3001 and test each account.
7. If a user already exists and you change the script, running the script again applies the configured password and role assignment.

The current script contains plaintext demo passwords. For a shared or production-grade environment, replace this approach with a secure secret input mechanism or secret store and do not commit actual credentials.

Alternatively, update a user's password in Keycloak directly:

1. Open http://localhost:8080/admin/.
2. Sign in with a working Keycloak administrator account.
3. Select the `ai-starter` realm and open **Users**.
4. Select the user and open **Credentials**.
5. Set a new password and disable **Temporary** if the user should not be forced to change it at the next login.
6. Open **Role mapping** and confirm that the user has only the intended realm role.

If you change a password in the Keycloak UI but leave the old password in `scripts/bootstrap-keycloak-users.sh`, running that script later will set the password back to the value in the script. Keep them aligned or update the script.

### Create a dedicated application administrator

The realm defines an `admin` role, but the current local bootstrap script provisions only `Developer` and `Viewer`.

To create a local administrator:

1. Sign in to the Keycloak administration console.
2. Select the `ai-starter` realm.
3. Create a user with a unique username and a strong local-only password.
4. Enable the user.
5. Set the password under **Credentials**.
6. Under **Role mapping**, assign the realm role `admin`.
7. Test the account in the application and verify that its displayed roles and allowed operations match the intended policy.

Do not simply grant `admin` to a developer account to avoid testing role separation. Keep separate accounts when validating role-based behavior.

### Rotate the OIDC client secret

The confidential OIDC client is `ai-starter-web`.

1. In Keycloak, open the `ai-starter` realm and select **Clients** → `ai-starter-web`.
2. Locate the client credentials/secret section and generate or set a new secret using the controls supported by your Keycloak version.
3. Update `AUTH_KEYCLOAK_SECRET` in `.env.local` to the same value.
4. Restart the Next.js development server so it reloads environment variables.
5. Verify login again.

The checked-in realm export contains a local development client secret. Replace it before sharing or publishing the starter kit. Do not put a production secret into a committed JSON file; prefer environment-specific realm provisioning for shared deployments.

### Change the Keycloak bootstrap administrator password

For a fresh local database, `setupscripts.sh` creates `.env.keycloak` with a randomly generated `KC_BOOTSTRAP_ADMIN_PASSWORD`. To choose your own password before first initialization:

1. Edit `.env.keycloak` before starting Keycloak for the first time.
2. Set `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD`.
3. Protect the file:

   ```bash
   chmod 600 .env.keycloak
   ```

For an already-initialized Keycloak data volume, changing `.env.keycloak` does **not** change the existing administrator's password. Use the Keycloak administration UI or a supported recovery procedure instead. Do not delete the volume just to change a password.

### Change Archestra and provider credentials

1. Open the Archestra UI at http://localhost:3000.
2. Sign in using the administrator account configured for that Archestra instance.
3. Configure the model/provider connection, such as OpenRouter, using credentials from the provider.
4. Create or rotate an Archestra virtual key for the application.
5. Update these values in `.env.local`:

   ```dotenv
   ARCHESTRA_BASE_URL=http://localhost:9000/v1
   ARCHESTRA_VIRTUAL_KEY=<your-new-archestra-virtual-key>
   ARCHESTRA_MODEL=<model-id-configured-in-archestra>
   ```

6. Restart the Next.js development server to load the changed environment.
7. Test the integration:

   ```bash
   pnpm test:archestra
   ```

Archestra login/bootstrap behavior can vary by image version and existing persistent data. This repository does not provide a universal Archestra password. Do not delete Archestra volumes to recover a login without first reviewing the supported recovery procedure and backing up any data you need.

### Before sharing or publishing

Before making the repository public or using it in a shared environment:

- Replace the demo developer/viewer passwords.
- Replace the local OIDC client secret and ensure local environment configuration matches it.
- Remove personal or real provider credentials from local files and commit history.
- Keep `.env`, `.env.local`, and `.env.keycloak` ignored and untracked.
- Avoid committing production secrets into realm exports or scripts.
- Rotate any secret that has been exposed.
- Treat all credentials in this section as local-only examples.

## Daily Docker operations

Run Compose commands from the repository root.

### Start, stop, and restart

You can use the convenient `pnpm` lifecycle scripts or direct `docker compose` commands:

```bash
# Start services (Keycloak & Archestra)
pnpm infra:up     # or: docker compose up -d

# Show service state
pnpm infra:status # or: pnpm dev:status / docker compose ps

# Stop containers and network; preserve named volumes
pnpm infra:down   # or: pnpm dev:down / docker compose down

# Restart all services in the current project
docker compose restart
```

# Restart one service.
docker compose restart keycloak
docker compose restart archestra

# Recreate containers after Compose changes; named volume data is retained.
docker compose up -d --force-recreate

# Pull configured images and start services as appropriate.
docker compose pull
docker compose up -d
```

**Project migration warning:** `docker compose down` targets the project name resolved from the current configuration. If existing containers still have a label from a previous Compose project, running `docker compose down` with the new name `ai-starter` will not stop those old containers. Inspect project labels first.

Do not append `-v` to routine `docker compose down`.

### Logs and status

```bash
# Current-project logs.
docker compose logs --tail=200

# Follow all logs.
docker compose logs -f

# Service-specific logs.
docker compose logs --tail=200 archestra
docker compose logs --tail=200 keycloak

# List containers across Compose projects.
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

# Live resource use.
docker stats --no-stream
```

### Restart Next.js independently

The app is a host process, not a Compose service. In its terminal, press `Ctrl+C`, then run:

```bash
pnpm dev --port 3001
```

To identify the process first:

```bash
ps aux | grep '[n]ext dev'
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Stop only the identified Next.js process. Do not kill all Node processes, because other projects may be using them.

### Execute commands inside containers

```bash
# Shell in Archestra, if the image includes sh.
docker exec -it archestra sh

# Shell in Keycloak.
docker exec -it keycloak /bin/bash

# Fallback if bash is unavailable.
docker exec -it keycloak /bin/sh

# Keycloak version.
docker exec keycloak /opt/keycloak/bin/kc.sh --version

# Mounts used by Archestra.
docker inspect archestra \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'

# Mounts used by Keycloak.
docker inspect keycloak \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
```

Container images may not include a shell or every diagnostic utility. If a command is missing, use `docker logs`, `docker inspect`, or the relevant product documentation. Do not print all container environment variables; they may contain credentials.

### Keycloak checks

```bash
# OIDC discovery document.
curl --fail --silent --show-error \
  http://localhost:8080/realms/ai-starter/.well-known/openid-configuration \
  | jq '{issuer, authorization_endpoint, token_endpoint, jwks_uri}'

# Admin UI HTTP response.
curl -sS -o /dev/null \
  -w 'Keycloak admin HTTP status: %{http_code}\n' \
  http://localhost:8080/admin/

# Recent logs.
docker compose logs --tail=200 keycloak

# Container state and mounts.
docker inspect keycloak --format 'status={{.State.Status}}'
docker inspect keycloak \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
```

A successful discovery response confirms the realm metadata is available. It does not prove interactive login or that a test user has the correct roles.

### Archestra checks

```bash
open http://localhost:3000
docker compose logs --tail=200 archestra
docker inspect archestra \
  --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}'
docker inspect archestra \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
```

The proxy root `/` is not guaranteed to be a health endpoint. Prefer `pnpm test:archestra` for an end-to-end model-path test.

### Persistent-volume diagnostics

```bash
# Inspect expected volume names; this does not delete them.
docker volume inspect \
  ai-starter-postgres-data \
  ai-starter-app-data \
  ai-starter-keycloak-data

# List Docker volumes.
docker volume ls

# Show processes in the Archestra container.
docker top archestra

# Check whether psql exists in the Archestra container.
docker exec archestra sh -lc 'command -v psql || true'
```

The Compose file mounts Archestra's PostgreSQL data directory at `/var/lib/postgresql/data`. Do not assume a database name, user, or password that is not documented by the actual running configuration. Keycloak's local development storage is separate from Archestra's PostgreSQL data; do not assume Keycloak uses the Archestra database.

### Endpoint checks

```bash
# Homepage.
curl -sS -o /dev/null \
  -w 'Homepage HTTP status: %{http_code}\n' \
  http://localhost:3001/

# Auth.js providers.
curl -sS -o /dev/null \
  -w 'Auth providers HTTP status: %{http_code}\n' \
  http://localhost:3001/api/auth/providers

# Keycloak discovery.
curl -sS -o /dev/null \
  -w 'Keycloak discovery HTTP status: %{http_code}\n' \
  http://localhost:8080/realms/ai-starter/.well-known/openid-configuration

# Mastra-to-Archestra integration.
pnpm test:archestra
```

### Port conflicts

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
lsof -nP -iTCP:9000 -sTCP:LISTEN
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Identify the process before stopping it. Do not terminate unrelated processes.

## Troubleshooting

### Compose configuration fails

```bash
./setupscripts.sh
docker compose config
```

Check that `.env` contains the correct `COMPOSE_PROJECT_NAME` and that `package.json` has a valid package name. Do not share local environment file contents.

### Keycloak does not start

```bash
docker compose ps
docker compose logs --tail=200 keycloak
docker inspect keycloak \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
```

Check that `.env.keycloak` exists and has both expected bootstrap variables. Bootstrap environment variables do not reset accounts in an initialized data volume.

### OIDC login fails

1. Verify Keycloak is reachable at http://localhost:8080.
2. Verify realm discovery at `/realms/ai-starter/.well-known/openid-configuration`.
3. Confirm `.env.local` has client ID `ai-starter-web`, the matching issuer, and a client secret matching the realm export.
4. Confirm the realm client has redirect URI `http://localhost:3001/*`, confidential client authentication, standard flow, and PKCE `S256`.
5. Check application logs without printing secrets.
6. Confirm the test user is enabled and assigned the intended realm role.

Do not reset or delete volumes simply because login fails.

### AI integration fails

```bash
docker compose ps
docker compose logs --tail=200 archestra
pnpm test:archestra
```

Verify locally that `ARCHESTRA_BASE_URL`, `ARCHESTRA_VIRTUAL_KEY`, and `ARCHESTRA_MODEL` are correct. Never print or share the virtual key.

### Port is already in use

Use the port diagnostics above. Stop only the identified conflicting process or update all related settings together (Compose ports, application port, and Keycloak redirect URI).

## Persistent-volume safety

The Compose project and volume names are derived from the package name. With the current package name, expected resources are:

```text
Project:     ai-starter
PostgreSQL:  ai-starter-postgres-data
App data:    ai-starter-app-data
Keycloak:    ai-starter-keycloak-data
```

If this checkout previously ran under a different Compose project name, existing containers may still be attached to that project and its volumes. New volumes do not inherit or copy existing data.

Inspect current labels and attachments before switching projects:

```bash
for container in archestra keycloak charming_buck; do
  if docker inspect "$container" >/dev/null 2>&1; then
    echo "=== $container ==="
    docker inspect "$container" \
      --format 'project={{index .Config.Labels "com.docker.compose.project"}}'
    docker inspect "$container" \
      --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
  fi
done
```

A safe migration plan is:

1. Validate `docker compose config`.
2. Inspect existing project labels and volume attachments.
3. Confirm which existing data must be retained or discarded.
4. Stop only the old Compose project by explicitly targeting its old project name if necessary.
5. Start the new project with `docker compose up -d`.
6. Verify containers, health, OIDC discovery, login, roles, and AI integration.
7. Keep old volumes until the new installation is confirmed and you explicitly approve removal.

A stopped container can still reference a volume. Inspect and handle old containers before attempting to remove any old volume.

### Destructive commands

Routine cleanup should use:

```bash
docker compose down
```

Do **not** use these as general troubleshooting commands:

```bash
# DESTRUCTIVE: can remove named volumes belonging to the targeted project.
docker compose down -v

# DESTRUCTIVE: can remove unrelated unused volumes from other projects.
docker volume prune
```

Never delete a volume until its exact name and attachments are verified and any needed data has been backed up.

## Security and production readiness

This project is intended for local development. Before production use:

- Configure HTTPS and production Keycloak hostname settings.
- Use supported, pinned images and review their provenance.
- Keep credentials server-side and rotate them securely.
- Use a supported production database and documented backup/recovery procedures.
- Enforce authorization on every protected API operation.
- Add automated authentication and authorization tests.
- Add rate limiting, audit logging, and operational monitoring.
- Review network exposure and container privileges.
- Define incident response and restore procedures.

Keycloak `start-dev` mode and local HTTP endpoints are not production settings.

## Project status

The following reflects the latest reported local checks as of **2026-10-13**. Update this section as new verification is completed.

| Check | Status |
|---|---|
| TypeScript (`pnpm exec tsc --noEmit`) | Passed in the reported working tree |
| ESLint (`pnpm lint`) | Passed in the reported working tree |
| Production build (`pnpm build`) | Passed in the reported working tree |
| OIDC client/secret/issuer file consistency | Passed |
| Compose project name and expected volume names | Passed static configuration validation |
| Keycloak realm discovery | Verified in the local runtime |
| Developer and viewer demo users enabled, with no required actions | Verified in the local runtime |
| New `ai-starter` Compose project started with new volumes | Not yet verified as a complete clean-start workflow |
| Interactive Keycloak browser login/logout | Must be verified end-to-end |
| Role extraction and server-enforced API authorization | Must be verified with real sessions |
| Authenticated dashboard AI test | Must be verified after login |

Track implementation status in `docs/MASTER_CHECKLIST.md`. Mark a capability complete only after it has been implemented and verified.

## Contributing

Before opening a pull request:

1. Explain the intended change.
2. Run the relevant static and integration checks.
3. Include reproduction steps for defects.
4. Remove credentials and sensitive information from logs.
5. Update the master checklist when implementation status changes.
6. Run `git diff --check`.

Never commit `.env`, `.env.local`, `.env.keycloak`, tokens, virtual keys, or real credentials.

## License

A license has not yet been selected. Add an appropriate `LICENSE` file before publishing as an open-source project. Until then, do not assume others have permission to redistribute or use the code.

## GitHub repository setup

Repository URL: https://github.com/rnikadi/ai-starter

HTTPS clone URL:

```bash
git clone https://github.com/rnikadi/ai-starter.git
```

SSH remote:

```bash
git@github.com:rnikadi/ai-starter.git
```

If you have an existing local repository and want to connect it to this GitHub repository, first inspect the current remotes and branch:

```bash
git remote -v
git branch --show-current
git status --short
```

If `origin` is not already configured, add it:

```bash
git remote add origin git@github.com:rnikadi/ai-starter.git
git branch -M main
```

If `origin` already exists, inspect it before changing it:

```bash
git remote get-url origin
```

Only after reviewing the working tree and confirming the intended files are ready to publish, stage and commit the intended changes, then push:

```bash
git add README.md
git commit -m "docs: update project README"
git push -u origin main
```

Do not stage environment files or secrets. This repository is currently private; review the repository contents, commit history, license, and all tracked configuration before changing its visibility to public.

## Local development

See [Keycloak and local test users](#keycloak-and-local-test-users) for provisioning demo accounts and local verification commands.
