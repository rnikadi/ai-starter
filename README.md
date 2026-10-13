# AI Starter

A reusable, local-first starter kit for AI applications built with
Next.js, TypeScript, Mastra, Archestra, OpenRouter, and Keycloak.

This repository provides a small web application, an AI integration path
through an LLM gateway, local identity infrastructure, and repeatable
development commands. It is a development starter---not a
production-ready platform.

> **Current status:** TypeScript, lint, and production build checks have
> passed in the existing working tree. The OIDC client ID, issuer, and
> exported client secret have been checked for consistency. The Compose
> project and volume names have been validated statically. The new
> `ai-starter` Compose project has not yet been started with its new
> volumes, and interactive login/RBAC must be verified against that
> runtime.

## 1. Architecture

``` text
Browser
  |
  v
Next.js application (host) :3001
  |  Auth.js / Keycloak OIDC
  |  Application API
  v
Mastra agent
  |
  v
Archestra LLM proxy :9000
  |
  v
Configured model provider (for example, OpenRouter)

Local infrastructure:
  Archestra UI  :3000
  Keycloak      :8080
```

  -----------------------------------------------------------------------
  Component               Responsibility          Local address
  ----------------------- ----------------------- -----------------------
  Next.js                 UI, Auth.js             http://localhost:3001
                          integration,            
                          application API         

  Mastra                  Agent execution and     In-process
                          model invocation        

  Archestra               LLM gateway and model   http://localhost:9000
                          routing                 

  Archestra UI            Gateway administration  http://localhost:3000

  Keycloak                OIDC identity provider  http://localhost:8080
                          and realm roles         

  OpenRouter or another   Model inference behind  Configured in Archestra
  configured provider     Archestra               
  -----------------------------------------------------------------------

The Next.js app runs on the host with pnpm; it is not a service in the
current `docker-compose.yaml`. Infrastructure ports are bound to
loopback for local development.

### Request flow

1.  A browser opens the Next.js app.
2.  Sign-in is delegated to Keycloak through Auth.js.
3.  The application uses the session and realm roles to render
    role-aware UI.
4.  An authorized AI test request invokes the Mastra agent.
5.  Mastra routes the model request through Archestra to the configured
    provider.
6.  The response returns through Mastra to the API/UI.

Authentication and authorization behavior must be verified with real
browser sessions and HTTP status checks. A successful static build or
OIDC discovery response does not prove the full login flow works.

## 2. Naming conventions

`package.json` is the source of truth for the package/application name:

``` json
{
  "name": "ai-starter"
}
```

`./setupscripts.sh` reads this value and writes `COMPOSE_PROJECT_NAME`
to the ignored local `.env` file. Docker Compose uses that value for the
project name and the named volumes.

Expected names with the current package name:

  Resource                            Expected name
  ----------------------------------- --------------------------------
  Compose project                     `ai-starter`
  Archestra PostgreSQL data volume    `ai-starter-postgres-data`
  Archestra application data volume   `ai-starter-app-data`
  Keycloak data volume                `ai-starter-keycloak-data`
  Archestra service/container         `archestra`
  Keycloak service/container          `keycloak`

The logical volume keys in Compose are `postgres-data`, `app-data`, and
`keycloak-data`; their actual Docker volume names are explicitly derived
from `COMPOSE_PROJECT_NAME`.

**Changing the package name does not rename existing containers or move
data between volumes.** Existing containers can retain the old Compose
project label and old volume attachments until explicitly migrated.

## 3. Prerequisites

Install:

-   Git
-   Docker Desktop with Docker Compose
-   Node.js 24 or another project-supported release
-   pnpm 11.25.0
-   OpenSSL
-   `curl`
-   `jq` (optional, useful for formatted JSON output)

Check versions:

``` bash
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

## 4. Clone and prepare the repository

Clone the published repository and enter its root directory:

``` bash
git clone <YOUR-REPOSITORY-URL> ai-starter
cd ai-starter
```

If you already have the repository, run all commands below from its
root.

Prepare the local environment files:

``` bash
chmod +x setupscripts.sh
./setupscripts.sh
```

The setup script:

-   Reads the package name from `package.json`.
-   Creates/updates `.env` with `COMPOSE_PROJECT_NAME`.
-   Creates `.env.keycloak` with a randomly generated bootstrap
    administrator password if it does not exist.
-   Creates `.env.local` from `.env.example` if it does not exist.
-   Preserves existing `.env.local` and `.env.keycloak` files.
-   Does not stop containers, delete volumes, or migrate existing data.

If `.env.local` already exists, the setup script deliberately preserves
it. It will not automatically replace old API keys, model names, OIDC
settings, or other values.

### 4.1 Configure `.env.local`

Open `.env.local` in your editor. Do not paste it into chat, tickets, or
logs.

Important variables include:

  --------------------------------------------------------------------------
  Variable                   Purpose
  -------------------------- -----------------------------------------------
  `ARCHESTRA_BASE_URL`       Archestra OpenAI-compatible endpoint; local
                             examples use `http://localhost:9000/v1`

  `ARCHESTRA_VIRTUAL_KEY`    Virtual key configured in Archestra

  `ARCHESTRA_MODEL`          Model identifier available through Archestra

  `AUTH_KEYCLOAK_ID`         OIDC client ID; expected `ai-starter-web`

  `AUTH_KEYCLOAK_ISSUER`     Expected
                             `http://localhost:8080/realms/ai-starter`

  `AUTH_KEYCLOAK_SECRET`     Must match the confidential client secret in
                             `keycloak/realm-export.json`
  --------------------------------------------------------------------------

Use a model identifier and virtual key that are valid in your Archestra
configuration. Do not expose these values to browser-side code or
`NEXT_PUBLIC_*` variables.

To verify the non-secret naming configuration without printing secrets:

``` bash
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
client = next((c for c in realm.get("clients", []) if c.get("clientId") == client_id), None)

checks = {
    "OIDC client exists": client is not None,
    "OIDC client secret matches": bool(client and env.get("AUTH_KEYCLOAK_SECRET") and env["AUTH_KEYCLOAK_SECRET"] == client.get("secret")),
    "OIDC issuer matches": env.get("AUTH_KEYCLOAK_ISSUER") == f"http://localhost:8080/realms/{realm.get('realm')}",
}
for name, ok in checks.items():
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
if not all(checks.values()):
    raise SystemExit(1)
PY
```

This check reads the secret internally but prints only PASS/FAIL.

### 4.2 Configure `.env.keycloak`

Compose loads `.env.keycloak` into the Keycloak container. It contains:

``` text
KC_BOOTSTRAP_ADMIN_USERNAME
KC_BOOTSTRAP_ADMIN_PASSWORD
```

Keep this file private. Bootstrap variables are used to initialize an
administrator on a fresh Keycloak data store; changing the variables
does not reset an administrator password in an already-initialized
database.

### 4.3 Secret files

Do not commit:

``` text
.env
.env.local
.env.keycloak
```

The tracked examples are `.env.example` and `.env.keycloak.example`.
Never commit passwords, OIDC client secrets, virtual keys, access
tokens, or other credentials. Check `.gitignore` before adding
configuration files.

## 5. Validate Compose configuration and names

These checks are read-only with respect to running services:

``` bash
# Synchronize COMPOSE_PROJECT_NAME from package.json and prepare local env files.
./setupscripts.sh

# Validate the Compose model without starting services.
docker compose config --quiet

# Print the resolved project name and volume names.
docker compose config --format json | python3 -c '
import json, sys

config = json.load(sys.stdin)
print("Compose project:", config["name"])

for logical, volume in config.get("volumes", {}).items():
    name = volume.get("name", logical)
    print(f"{logical}: {name}")
'

# List configured services.
docker compose config --services
```

Expected project: `ai-starter`.

Expected services: `archestra`, `keycloak`.

Expected volumes:

``` text
postgres-data -> ai-starter-postgres-data
app-data -> ai-starter-app-data
keycloak-data -> ai-starter-keycloak-data
```

The named volumes are created when the new Compose project starts. A
successful `docker compose config` only validates configuration; it does
not prove that services can start or that their data is correct.

## 6. Start the infrastructure

After validating configuration:

``` bash
docker compose up -d
docker compose ps
```

Follow initialization logs:

``` bash
docker compose logs -f keycloak
docker compose logs -f archestra
```

Use separate terminals if following both services.

The first startup can take time. Wait for Keycloak to finish
initialization and for Archestra to become healthy before testing the
application.

### 6.1 Open the local UIs

-   Archestra: http://localhost:3000
-   Keycloak admin console: http://localhost:8080/admin/
-   Next.js application (after starting it): http://localhost:3001

## 7. Keycloak configuration

The realm export is `keycloak/realm-export.json`.

  Setting         Value
  --------------- ---------------------------
  Realm           `ai-starter`
  OIDC client     `ai-starter-web`
  Client type     Confidential
  Standard flow   Enabled
  PKCE            `S256`
  Redirect URI    `http://localhost:3001/*`
  Web origin      `http://localhost:3001`

Realm roles:

  Role          Intended purpose
  ------------- -----------------------------------------
  `viewer`      Read-only application capabilities
  `developer`   AI and development capabilities
  `admin`       Administrative application capabilities

The realm export includes a realm-role mapper intended to expose roles
through `realm_access.roles`.

### 7.1 Check Keycloak discovery

``` bash
curl --fail --silent --show-error \
  http://localhost:8080/realms/ai-starter/.well-known/openid-configuration \
  | jq '{issuer, authorization_endpoint, token_endpoint, jwks_uri}'
```

Expected issuer:

``` text
http://localhost:8080/realms/ai-starter
```

### 7.2 Create local test users

The repository includes `scripts/bootstrap-keycloak-users.sh` to
provision local developer and viewer test users. Review this script
before running it, and only use it against a disposable local Keycloak
instance. Its configured test credentials are for local development
only.

``` bash
bash -n scripts/bootstrap-keycloak-users.sh
bash scripts/bootstrap-keycloak-users.sh
```

The script uses Keycloak's `kcadm.sh` inside the `keycloak` container
and expects the administrator credentials to match the initialized
Keycloak database. If it fails at administrator authentication, do not
repeatedly reset volumes; first verify which administrator was
initialized and which database the container is using.

For browser verification:

1.  Open http://localhost:3001.
2.  Select **Sign in with Keycloak**.
3.  Sign in as the developer test user.
4.  Confirm the application returns to the local workspace and displays
    roles.
5.  Test the AI connectivity panel.
6.  Sign out and repeat with the viewer user.
7.  Confirm viewer access is restricted where required.
8.  Verify anonymous and viewer API requests return the status codes
    enforced by the current API route.

Do not mark login/RBAC as verified until these browser and HTTP checks
have actually passed.

## 8. Install dependencies and start Next.js

Install dependencies:

``` bash
pnpm install
```

Start the development server on port 3001 (required by the Keycloak
redirect URI):

``` bash
pnpm dev --port 3001
```

Keep the server running in its terminal. Open a second terminal for
validation commands.

The Next.js server runs on the host; restarting Docker Compose does not
restart the host process.

## 9. Credentials and Test Accounts

> **WARNING --- LOCAL DEVELOPMENT CREDENTIALS ONLY**
>
> The credentials and procedures in this section are intended only for a
> disposable local development environment. Change passwords, secrets,
> and API keys before sharing the project, publishing a repository, or
> deploying anywhere outside your own machine. Never commit `.env`,
> `.env.local`, `.env.keycloak`, access tokens, Archestra virtual keys,
> or real passwords. The demo passwords shown below are not secure
> defaults for shared environments.

This starter kit uses separate credentials for infrastructure
administration, AI gateway access, and application users. These are not
interchangeable.

### 8.1 Credentials overview

  ------------------------------------------------------------------------------------------------------------------------
  Service /        Username or identifier          Password / secret source        Where to update it
  account                                                                          
  ---------------- ------------------------------- ------------------------------- ---------------------------------------
  Keycloak         Value of                        Value of                        Edit `.env.keycloak` for a **fresh**
  bootstrap        `KC_BOOTSTRAP_ADMIN_USERNAME`   `KC_BOOTSTRAP_ADMIN_PASSWORD`   Keycloak data store. For an
  administrator    (the setup script initially     in local `.env.keycloak`;       already-initialized realm, change the
                   uses `admin`)                   `setupscripts.sh` generates a   administrator password through
                                                   random password when it creates Keycloak's administration UI or
                                                   this file                       supported account-recovery procedure;
                                                                                   editing the environment file alone does
                                                                                   not reset it

  Application OIDC Client ID `ai-starter-web`  Client secret in                Update both the realm client
  client                                           `keycloak/realm-export.json`,   configuration and `.env.local`
                                                   matched by                      together; never expose the secret to
                                                   `AUTH_KEYCLOAK_SECRET` in       browser-side code
                                                   `.env.local`                    

  Application      `starter-developer`             Current local bootstrap script  Update the password in
  developer test                                   sets `StarterDev123!`            `scripts/bootstrap-keycloak-users.sh`
  user                                                                             **and** update the user's password in
                                                                                   Keycloak, or change it in the Keycloak
                                                                                   UI and stop using the script's old
                                                                                   password

  Application      `starter-viewer`                Current local bootstrap script  Update the password in
  viewer test user                                 sets `StarterView123!`           `scripts/bootstrap-keycloak-users.sh`
                                                                                   **and** update the user's password in
                                                                                   Keycloak, or change it in the Keycloak
                                                                                   UI and stop using the script's old
                                                                                   password

  Application      No separate built-in admin      No default admin-role user's    Create a dedicated user in Keycloak,
  admin role       username is provisioned by the  password is defined by that     assign the `admin` realm role, and set
                   documented developer/viewer     script                          a unique password in Keycloak
                   bootstrap script                                                

  Archestra        No universal application-level  Set up or use the administrator Configure/manage access in the
  administration   default is defined by this      account required by the running Archestra UI at
  UI               repository                      Archestra instance              `http://localhost:3000`; follow the
                                                                                   prompts and version-specific setup for
                                                                                   your instance

  Archestra model  Virtual key configured in       `ARCHESTRA_VIRTUAL_KEY` in      Create or rotate the key in Archestra,
  gateway          Archestra                       `.env.local`; model identifier  then update `.env.local`. Configure the
                                                   is `ARCHESTRA_MODEL`            corresponding model/provider connection
                                                                                   in Archestra

  Model provider   Provider-specific account/API   Configured in Archestra's       Update the provider credential in
  (for example,    key                             provider/model connection       Archestra. Do not put provider keys in
  OpenRouter)                                                                      browser code or commit them to Git
  ------------------------------------------------------------------------------------------------------------------------

**Important:** The repository does not define a universal default
username/password for Archestra. Do not assume `admin/admin` or reuse
Keycloak credentials for Archestra. Follow the setup flow presented by
the actual Archestra image/version and store the resulting virtual key
in `.env.local`.

### 8.2 Current local test-user credentials

The current `scripts/bootstrap-keycloak-users.sh` script contains these
local-only test accounts:

  ---------------------------------------------------------------------------
  Application user      Keycloak realm     Realm role      Current script
                                                           password
  --------------------- ------------------ --------------- ------------------
  `starter-developer`   `ai-starter`   `developer`     `StarterDev123!`

  `starter-viewer`      `ai-starter`   `viewer`        `StarterView123!`
  ---------------------------------------------------------------------------

These are **generic local demo credentials, not secure defaults**. The bootstrap script uses `StarterDev123!` and `StarterView123!` for these test accounts. Change them before sharing the repository or using it in any shared environment. The
bootstrap script does not currently provision an application user with
the `admin` realm role.

The application uses Keycloak for sign-in. Therefore, application test
users are Keycloak realm users; they are not stored as separate
usernames/passwords in the Next.js application.

### 8.3 Change the developer and viewer test passwords

1.  Open `scripts/bootstrap-keycloak-users.sh`.
2.  Change `DEVELOPER_USER`, `DEVELOPER_PASSWORD`, `VIEWER_USER`, and
    `VIEWER_PASSWORD` to the local values you want.
3.  Do not use production or reused passwords in this script.
4.  Start Keycloak and verify that the `ai-starter` realm is
    available.
5.  Run the script to apply the configured users/passwords and role
    assignments:

``` bash
bash -n scripts/bootstrap-keycloak-users.sh
bash scripts/bootstrap-keycloak-users.sh
```

6.  Sign in to the application at `http://localhost:3001` and test each
    account.
7.  If a user already exists and you change the script, run the script
    again to update the password and ensure the role assignment is
    correct.

The current script contains plaintext demo passwords. For a shared or
production-grade environment, replace this approach with a secret input
mechanism or secure secret store and do not commit actual credentials.

Alternatively, update a user's password in Keycloak directly:

1.  Open `http://localhost:8080/admin/`.
2.  Sign in with a working Keycloak administrator account.
3.  Select the `ai-starter` realm and open **Users**.
4.  Select the user and open **Credentials**.
5.  Set a new password and disable **Temporary** if the user should not
    be forced to change it at the next login.
6.  Open **Role mapping** and confirm that the user has only the
    intended realm role.

If you change a password in the Keycloak UI but leave the old password
in `scripts/bootstrap-keycloak-users.sh`, running that script later will
set the password back to the value in the script. Keep them aligned or
update the script.

### 8.4 Create a dedicated application administrator

The realm defines an `admin` role, but the current local bootstrap
script provisions only `starter-developer` and `starter-viewer`.

To create a local administrator:

1.  Sign in to the Keycloak administration console.
2.  Select the `ai-starter` realm.
3.  Create a user with a unique username and a strong local-only
    password.
4.  Enable the user.
5.  Set the password under **Credentials**.
6.  Under **Role mapping**, assign the realm role `admin`.
7.  Test the account in the application and verify that its displayed
    roles and allowed operations match the intended policy.

Do not simply grant `admin` to a developer account to avoid testing role
separation. Keep separate accounts when validating role-based behavior.

### 8.5 Rotate the OIDC client secret

The confidential OIDC client is `ai-starter-web`.

1.  In Keycloak, open the `ai-starter` realm and select **Clients**
    → `ai-starter-web`.
2.  Locate the client credentials/secret section and generate or set a
    new secret using the controls supported by your Keycloak version.
3.  Update `AUTH_KEYCLOAK_SECRET` in `.env.local` to the same value.
4.  Restart the Next.js development server so it reloads environment
    variables.
5.  Verify login again.

The checked-in realm export contains a local development client secret.
Replace it before sharing or publishing the starter kit. If you change
the tracked realm export for local consistency, do not put a production
secret into a committed JSON file; prefer environment-specific realm
provisioning for shared deployments.

To check that the current local secret and realm export match without
printing the secret:

``` bash
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
client = next((c for c in realm.get("clients", []) if c.get("clientId") == client_id), None)

ok = bool(client and env.get("AUTH_KEYCLOAK_SECRET") and env["AUTH_KEYCLOAK_SECRET"] == client.get("secret"))
print("OIDC client secret matches realm export:", "PASS" if ok else "FAIL")
if not ok:
    raise SystemExit(1)
PY
```

### 8.6 Change the Keycloak bootstrap administrator password

For a fresh local database, `setupscripts.sh` creates `.env.keycloak`
with a randomly generated `KC_BOOTSTRAP_ADMIN_PASSWORD`. To choose your
own password before first initialization:

1.  Stop before starting Keycloak for the first time.
2.  Edit `.env.keycloak` and set `KC_BOOTSTRAP_ADMIN_USERNAME` and
    `KC_BOOTSTRAP_ADMIN_PASSWORD`.
3.  Protect the file with restrictive permissions:

``` bash
chmod 600 .env.keycloak
```

For an already-initialized Keycloak data volume, changing
`.env.keycloak` does **not** change the existing administrator's
password. Use the Keycloak administration UI or a supported recovery
procedure instead. Do not delete the volume just to change a password.

### 8.7 Change Archestra and provider credentials

1.  Open the Archestra UI at `http://localhost:3000`.
2.  Sign in using the administrator account configured for that
    Archestra instance.
3.  Configure the model/provider connection, such as OpenRouter, using
    credentials from the provider.
4.  Create or rotate an Archestra virtual key for the application.
5.  Update these values in `.env.local`:

``` dotenv
ARCHESTRA_BASE_URL=http://localhost:9000/v1
ARCHESTRA_VIRTUAL_KEY=<your-new-archestra-virtual-key>
ARCHESTRA_MODEL=<model-id-configured-in-archestra>
```

6.  Restart the Next.js development server to load the changed
    environment.
7.  Test the integration:

``` bash
pnpm test:archestra
```

The exact Archestra login/bootstrap behavior can vary by image version
and existing persistent data. This repository does not provide a
universal Archestra password. Do not delete Archestra volumes to recover
a login without first reviewing the supported recovery procedure and
backing up any data you need.

### 8.8 Before sharing or publishing

Before making the repository public or using it in a shared environment:

-   Replace the demo developer/viewer passwords.
-   Replace the local OIDC client secret and ensure local environment
    configuration matches it.
-   Remove any personal or real provider credentials from local files
    and commit history.
-   Keep `.env`, `.env.local`, and `.env.keycloak` ignored and
    untracked.
-   Avoid committing production secrets into realm exports or scripts.
-   Rotate any secret that has been exposed.
-   Treat all credentials in this section as local-only examples.

------------------------------------------------------------------------

## 10. Test the AI integration

The integration test is `scripts/test-archestra.ts` and is invoked by:

``` bash
pnpm test:archestra
```

It requires:

-   Docker Desktop running.
-   Archestra reachable.
-   `.env.local` configured with a valid Archestra endpoint, virtual
    key, and model.
-   The model connection configured and usable in Archestra.

Expected successful marker:

``` text
MASTRA_ARCHESTRA_CONNECTION_SUCCESS
```

This test exercises the Mastra-to-Archestra path. It does not, by
itself, prove browser authentication or RBAC.

### 9.1 Test the Next.js AI API

The current endpoint is `POST /api/ai/test`.

``` bash
curl --fail-with-body --silent --show-error --max-time 120 \
  http://localhost:3001/api/ai/test \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Reply with exactly: NEXTJS_MASTRA_ARCHESTRA_SUCCESS"}'
```

The API may require a valid session and an authorized role. If an
anonymous call is rejected, sign in through the browser and use an
authenticated browser session for authorized testing. Avoid assuming the
exact HTTP status without checking the route's current behavior.

## 11. Validation commands

Run before submitting changes:

``` bash
# TypeScript
pnpm exec tsc --noEmit

# ESLint
pnpm lint

# Production build
pnpm build

# Docker Compose schema/configuration
docker compose config --quiet

# Validate realm JSON
python3 -m json.tool keycloak/realm-export.json >/dev/null

# Validate bootstrap shell script
bash -n setupscripts.sh
bash -n scripts/bootstrap-keycloak-users.sh

# Whitespace and patch check
git diff --check
```

## 12. Command reference: daily Docker operations

Run Compose commands from the repository root.

### 11.1 Start, stop, restart, and recreate

``` bash
# Start services in the current Compose project.
docker compose up -d

# Show service state.
docker compose ps

# Stop/remove current-project containers and network; preserve named volumes.
docker compose down

# Start again later.
docker compose up -d

# Restart all services in the current project.
docker compose restart

# Restart one service.
docker compose restart keycloak
docker compose restart archestra

# Recreate containers after Compose changes; named volume data is retained.
docker compose up -d --force-recreate

# Pull configured images and then recreate as appropriate.
docker compose pull
docker compose up -d
```

**Project migration warning:** `docker compose down` targets the project
name resolved from the current configuration. If the existing containers
still have a label from the previous Compose project,
running `docker compose down` with the new name `ai-starter` will
not stop those old containers. Inspect the project labels first (Section
13).

Do not append `-v` to routine `docker compose down`.

### 11.2 Logs and status

``` bash
# All current-project logs.
docker compose logs --tail=200

# Follow all logs.
docker compose logs -f

# Service-specific logs.
docker compose logs --tail=200 archestra
docker compose logs --tail=200 keycloak
docker compose logs -f keycloak

# List all containers from all Compose projects.
docker ps -a \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

# Live resource use.
docker stats --no-stream
```

### 11.3 Restart the Next.js application independently

The app is a host process, not a Compose service. In its terminal, press
`Ctrl+C`, then run:

``` bash
pnpm dev --port 3001
```

If you need to identify the process first:

``` bash
ps aux | grep '[n]ext dev'
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Stop only the identified Next.js process. Do not kill all Node
processes, because other projects may be using them.

### 11.4 Execute commands inside containers

``` bash
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

Container images may not include a shell or every diagnostic utility. If
a command is missing, use `docker logs`, `docker inspect`, or the
relevant product documentation. Do not print all container environment
variables; they may contain credentials.

### 11.5 Keycloak checks

``` bash
# OIDC discovery document.
curl --fail --silent --show-error \
  http://localhost:8080/realms/ai-starter/.well-known/openid-configuration \
  | jq '{issuer, authorization_endpoint, token_endpoint, jwks_uri}'

# Admin UI HTTP response.
curl -sS -o /dev/null \
  -w 'Keycloak admin HTTP status: %{http_code}\n' \
  http://localhost:8080/admin/

# Logs from the current project.
docker compose logs --tail=200 keycloak

# Container state and mounts.
docker inspect keycloak \
  --format 'status={{.State.Status}}'
docker inspect keycloak \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
```

A successful discovery response confirms the realm metadata is
available. It does not prove interactive login or that a test user has
the correct roles.

### 11.6 Archestra checks

``` bash
# Open the Archestra UI.
open http://localhost:3000

# Inspect recent logs.
docker compose logs --tail=200 archestra

# Inspect state and health (if the image defines a health check).
docker inspect archestra \
  --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}'

# Inspect mounts.
docker inspect archestra \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
```

The proxy root `/` is not guaranteed to be a health endpoint. Prefer
`pnpm test:archestra` for an end-to-end model-path test.

### 11.7 Database and persistent-volume diagnostics

The Compose file mounts Archestra's PostgreSQL data directory at
`/var/lib/postgresql/data`. The Archestra image manages its database
internals; do not assume a database name, user, or password that is not
documented by the actual running configuration.

``` bash
# Check expected new volume names.
docker volume inspect \
  ai-starter-postgres-data \
  ai-starter-app-data \
  ai-starter-keycloak-data

# List Docker volumes without deleting them.
docker volume ls

# Show processes in the Archestra container.
docker top archestra

# Check whether psql exists in the Archestra container.
docker exec archestra sh -lc 'command -v psql || true'
```

If `psql` exists and you have verified the actual connection settings
through approved local configuration, run read-only queries using those
verified values. Example SQL:

``` sql
SELECT version();
SELECT current_database();
SELECT current_user;
```

Do not guess the database name or credentials. Do not print connection
strings or passwords in logs or chat. Keycloak's local development
storage is separate from Archestra's PostgreSQL data; do not assume
Keycloak uses the Archestra database.

### 11.8 Endpoint checks

``` bash
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

### 11.9 Port conflicts

``` bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
lsof -nP -iTCP:9000 -sTCP:LISTEN

docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Identify the process before stopping it. Do not terminate unrelated
processes.

## 13. Troubleshooting

### Compose configuration fails

``` bash
./setupscripts.sh
docker compose config
```

Check that `.env` contains the correct `COMPOSE_PROJECT_NAME` and that
`package.json` has a valid package name. Do not share local environment
file contents.

### Keycloak does not start

``` bash
docker compose ps
docker compose logs --tail=200 keycloak
docker inspect keycloak \
  --format '{{range .Mounts}}{{println .Name "->" .Destination}}{{end}}'
```

Check that `.env.keycloak` exists and has both expected bootstrap
variables. Bootstrap environment variables do not reset accounts in an
initialized data volume.

### OIDC login fails

1.  Verify Keycloak is reachable at `http://localhost:8080`.
2.  Verify realm discovery at
    `/realms/ai-starter/.well-known/openid-configuration`.
3.  Confirm `.env.local` has client ID `ai-starter-web`, the
    matching issuer, and a client secret matching the realm export.
4.  Confirm the realm client has redirect URI `http://localhost:3001/*`,
    confidential client authentication, standard flow, and PKCE `S256`.
5.  Check application logs without printing secrets.
6.  Confirm the test user is enabled and assigned the intended realm
    role.

Do not reset or delete volumes simply because login fails.

### AI integration fails

``` bash
docker compose ps
docker compose logs --tail=200 archestra
pnpm test:archestra
```

Verify locally that `ARCHESTRA_BASE_URL`, `ARCHESTRA_VIRTUAL_KEY`, and
`ARCHESTRA_MODEL` are correct. Never print or share the virtual key.

### Port is already in use

Use the port diagnostics in Section 12.9. Stop only the identified
conflicting process or update all related settings together (Compose
ports, application port, and Keycloak redirect URI).

## 14. Compose project migration and volume safety

The new configuration resolves the project name and volumes to:

``` text
Project:      ai-starter
PostgreSQL:   ai-starter-postgres-data
App data:     ai-starter-app-data
Keycloak:     ai-starter-keycloak-data
```

If this checkout previously ran under a different Compose project name, its
existing containers may still be attached to that project and its volumes.
The new volumes do not inherit or copy existing data.

Inspect the current labels and attachments before switching:

``` bash
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

1.  Validate `docker compose config`.
2.  Inspect existing project labels and volume attachments.
3.  Confirm which existing data must be retained or discarded.
4.  Stop only the old Compose project by explicitly targeting its old
    project name if necessary.
5.  Start the new project with `docker compose up -d`.
6.  Verify the new containers, health, OIDC discovery, login, roles, and
    AI integration.
7.  Keep the old volumes until the new installation is confirmed and you
    explicitly approve removal.

The exited `charming_buck` container has previously been observed
referencing the old Archestra volumes. A stopped container can still
reference a volume. Inspect and handle that container before attempting
to remove any old volume.

### Destructive commands

Routine cleanup should use:

``` bash
docker compose down
```

Do **not** use these as general troubleshooting commands:

``` bash
# DESTRUCTIVE: can remove named volumes belonging to the targeted project.
docker compose down -v

# DESTRUCTIVE: can remove unrelated unused volumes from other projects.
docker volume prune
```

Never delete a volume until its exact name and attachments are verified
and any needed data has been backed up. This README does not authorize
deleting old development volumes.

## 15. Security and production readiness

This project is intended for local development. Before production use:

-   Configure HTTPS and production Keycloak hostname settings.
-   Use supported, pinned images and review their provenance.
-   Keep credentials server-side and rotate them securely.
-   Use a supported production database and documented backup/recovery
    procedures.
-   Enforce authorization on every protected API operation.
-   Add automated authentication and authorization tests.
-   Add rate limiting, audit logging, and operational monitoring.
-   Review network exposure and container privileges.
-   Define incident response and restore procedures.

Keycloak `start-dev` mode and local HTTP endpoints are not production
settings.

## 16. Project checklist and contribution

Track implementation status in `docs/MASTER_CHECKLIST.md`. Mark a
capability complete only after it has been implemented and verified.

Before opening a pull request:

1.  Explain the intended change.
2.  Run the relevant static and integration checks.
3.  Include reproduction steps for defects.
4.  Remove credentials and sensitive information from logs.
5.  Update the checklist when implementation status changes.
6.  Run `git diff --check`.

Never commit `.env`, `.env.local`, `.env.keycloak`, tokens, virtual
keys, or real credentials.

## 17. License

A license has not yet been selected. Add an appropriate `LICENSE` file
before publishing as an open-source project. Until then, do not assume
others have permission to redistribute or use the code.

## 18. Current verification record

Last updated: 2026-10-13.

  ---------------------------------------------------------------------
  Check                              Status
  ---------------------------------- ----------------------------------
  TypeScript                         Passed in the existing working
  (`pnpm exec tsc --noEmit`)         tree

  ESLint (`pnpm lint`)               Passed in the existing working
                                     tree

  Production build (`pnpm build`)    Passed in the existing working
                                     tree

  `git diff --check`                 Passed after the recent
                                     naming/documentation changes

  OIDC client/secret/issuer file     Passed
  consistency                        

  Compose project name and expected  Passed static configuration
  volume names                       validation

  New `ai-starter` containers    Not yet verified
  started                            

  Interactive Keycloak browser login Must be verified after runtime
                                     migration

  Role extraction and API            Must be verified with real
  authorization                      sessions

  Authenticated dashboard AI test    Must be verified after login
  ---------------------------------------------------------------------

These statuses describe the reported local checks and should be updated
as new runtime verification is completed.
