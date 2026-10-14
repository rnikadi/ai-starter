# Master Checklist --- AI Starter

Last updated: 2026-10-13

## 1. Project Objective\*\*

Build a reusable, local-first TypeScript AI application starter that
integrates:

-   Next.js and React for the application UI and HTTP API.

-   Mastra for AI agent execution.

-   Archestra as the LLM gateway.

-   OpenRouter as the model provider through Archestra.

-   Keycloak for identity, authentication, and realm roles.

-   Server-side session handling and authorization for protected
    application capabilities.

The longer-term objective is to provide a reusable foundation for
AI-powered web applications with role-based access control.

The project must distinguish between capabilities already implemented,

infrastructure configured but not yet verified, planned functionality,
and

production-readiness requirements.

## 2. Architectural Decisions\*\*

### Application architecture\*\*

-   [x] Use Next.js and TypeScript as the application foundation.

-   [x] Use Mastra for the existing AI agent integration.

-   [x] Route model requests through Archestra.

-   [x] Use OpenRouter through Archestra for model access.

-   [x] Keep model-provider credentials out of browser-side code.

-   [ ] Complete the application authentication and authorization
    boundary.

-   [ ] Protect all applicable API operations with server-side
    authorization.

### Local infrastructure and ports\*\*

-   [x] Reserve host port 3000 for the Archestra UI.

-   [x] Reserve host port 3001 for the Next.js application.

-   [x] Reserve host port 3002 for the Grafana Observability Dashboard.

-   [x] Reserve host port 3100 for the Grafana Loki log aggregation service.

-   [x] Reserve host port 4000 for the standalone Node.js API backend.

-   [x] Reserve host port 8080 for Keycloak IAM.

-   [x] Reserve host port 9000 for the Archestra LLM proxy.

-   [x] Reserve host port 9090 for Prometheus metric collection.

-   [x] Bind local development services to loopback where configured.

-   [x] Define Docker Compose services for the local environment.

-   [x] Configure persistent Docker volumes in the Compose definition.

-   [x] Preserve existing Archestra external volumes.

-   [x] Configure multi-stage production Dockerfiles for frontend and backend.

-   [x] Configure unified observability stack with Grafana, Loki, and Promtail.

-   [ ] Verify all running containers and persistent volumes after
    startup.

### Identity and security\*\*

-   [x] Define an `ai-starter` Keycloak realm export.

-   [x] Define the `ai-starter-web` OIDC client in the realm
    configuration.

-   [x] Define the `viewer`, `developer`, and `admin` realm roles in the
    configuration.

-   [ ] Verify the effective realm, client, and roles in the running
    Keycloak instance.

-   [ ] Implement the application OIDC login flow.

-   [ ] Implement secure server-side session handling.

-   [ ] Enforce authorization on protected server/API boundaries.

-   [ ] Verify that direct API requests cannot bypass authorization.

-   [x] Add environment example files for local configuration.

-   [x] Confirm `.env.local` and `.env.keycloak` are ignored by Git.

-   [ ] Complete a pre-commit review for accidental credentials and
    sensitive data.

### Environment limitations\*\*

-   [x] Use local Docker-based infrastructure for the current
    development setup.

-   [x] Keep the local Keycloak development database separate from a
    production design.

-   [ ] Define the production database, secret management, TLS, and
    deployment strategy.

## 3. FOUNDATION\*\*

### 3.1 Repository and application foundation\*\*

-   [x] Configure the TypeScript application foundation.

-   [x] Add the Mastra agent integration.

-   [x] Add the AI API route.

-   [x] Add the Archestra connection test script.

-   [x] Add the local Docker Compose configuration.

-   [x] Add Keycloak realm configuration.

-   [x] Add environment example files.

-   [x] Add the setup preparation script.

-   [x] Create the project README.

-   [x] Create and maintain this master checklist.

-   [ ] Confirm the final GitHub repository URL.

-   [ ] Replace the repository URL placeholder in the README.

-   [ ] Select and add an appropriate open-source license.

### 3.2 Existing AI integration\*\*

-   [x] Implement the Next.js API route that invokes the Mastra agent.

-   [x] Configure the Mastra-to-Archestra connection.

-   [x] Configure the model request path through Archestra to
    OpenRouter.

-   [x] Validate the Archestra connection test successfully.

-   [x] Receive the expected `MASTRA_ARCHESTRA_CONNECTION_SUCCESS`
    response.

-   [x] Run the TypeScript check successfully.

-   [x] Run ESLint successfully.

Validation evidence:

-   `pnpm exec tsc --noEmit` passed.

-   `pnpm lint` passed.

-   `pnpm test:archestra` passed.

-   The integration test returned the expected success marker.

Note:

The successful integration test verifies the tested AI request path. It
does

not establish that authentication, RBAC, or production deployment is
complete.

### 3.3 Docker Compose and local configuration\*\*

-   [x] Define the Archestra service in `docker-compose.yaml`.

-   [x] Pin the configured Archestra image version and digest.

-   [x] Define the Keycloak service in `docker-compose.yaml`.

-   [x] Configure Keycloak environment loading from `.env.keycloak`.

-   [x] Configure the Keycloak realm import mount.

-   [x] Define persistent volumes in the Compose configuration.

-   [x] Validate the Docker Compose configuration successfully.

-   [x] Validate `setupscripts.sh` syntax successfully.

-   [x] Validate `keycloak/realm-export.json` JSON syntax successfully.

-   [x] Confirm `.env.local` is ignored by Git.

-   [x] Confirm `.env.keycloak` is ignored by Git.

-   [ ] Verify the running Archestra and Keycloak containers.

-   [ ] Verify that existing Docker volumes and their contents remain
    intact.

-   [ ] Verify Keycloak readiness and realm discovery against the
    running service.

Validation evidence:

-   `docker compose config --quiet` passed.

-   `bash -n setupscripts.sh` passed.

-   `python3 -m json.tool keycloak/realm-export.json` passed.

-   `git check-ignore .env.local .env.keycloak` listed both files.

### 3.4 Keycloak infrastructure\*\*

-   [x] Add Keycloak to the Docker Compose configuration.

-   [x] Configure the local Keycloak HTTP port.

-   [x] Configure persistent Keycloak development data.

-   [x] Provide a realm export for `ai-starter`.

-   [x] Define the `ai-starter-web` client in the realm export.

-   [x] Define the initial realm roles in the realm export.

-   [x] Provide `.env.keycloak.example`.

-   [x] Keep the actual `.env.keycloak` file out of Git.

-   [ ] Verify the running Keycloak realm configuration.

-   [ ] Verify the effective OIDC client configuration.

-   [ ] Verify the expected roles in the running realm.

-   [ ] Verify realm discovery and authentication endpoints.

-   [ ] Test a complete authorization-code login flow.

Configuration being present in a JSON file is not equivalent to
verifying

that the running Keycloak instance has applied that configuration.

An existing realm may not be reconciled automatically when an import is

skipped because the realm already exists. Verify the live configuration

before assuming that every exported setting has been applied.

## 4. FEATURE\*\*

### 4.1 Authentication UI\*\*

-   [x] Create the login page.

-   [x] Initiate login through Keycloak using OIDC authorization code
    flow.

-   [x] Handle successful authentication and application return
    navigation.

-   [x] Handle authentication errors.

-   [x] Implement logout.

-   [x] Protect authenticated application pages.

-   [x] Display an appropriate unauthenticated state.

-   [ ] Test session expiry and logout behavior in live browser.

### 4.2 Application dashboard\*\*

-   [x] Display the authenticated user's identity.

-   [x] Display the effective application roles.

-   [x] Provide role-aware navigation.

-   [x] Display useful authorization-denied feedback.

-   [x] Ensure the UI does not become the sole authorization control.

### 4.3 AI interaction UI\*\*

-   [x] Add a prompt input and submit action.

-   [x] Display the Mastra agent response.

-   [x] Display loading and error states.

-   [x] Connect the UI to the AI API.

-   [x] Require authentication before accessing the protected AI
    operation.

-   [x] Preserve the existing AI integration contract where practical.

-   [x] Ensure confidential provider credentials never reach browser
    code.

### 4.4 Authorization model\*\*

-   [x] Define a reusable application permission model.

-   [x] Map trusted Keycloak roles to application permissions.

-   [x] Define the initial capabilities available to `viewer`.

-   [x] Define the initial capabilities available to `developer`.

-   [x] Define the initial capabilities available to `admin`.

-   [x] Enforce authorization on the server.

-   [x] Enforce RBAC middleware guards (`guardAuth`, `guardRoles`).

### 4.5 Platform plumbing & Observability\*\*

-   [x] Implement structured JSON logging with correlation IDs (`x-request-id`).

-   [x] Implement standardized liveness probe (`/healthz`) and readiness probe (`/readyz`).

-   [x] Implement fail-fast Zod environment schema validation on boot.

-   [x] Implement in-memory API rate limiting (`apiRateLimiter`, `aiRateLimiter`).

-   [x] Implement OpenAPI 3.1 specification (`/openapi.json`) and offline documentation (`/docs`).

-   [x] Implement offline mock AI mode (`MOCK_AI=true`).

-   [x] Configure production multi-stage Dockerfiles for frontend and backend.

-   [x] Configure centralized visual logging and metrics stack with Grafana, Loki, Promtail, and Prometheus.

-   [x] Implement GitHub Actions CI verification workflow (`.github/workflows/ci.yml`).

-   [ ] Return HTTP 401 for unauthenticated protected requests.

-   [ ] Return HTTP 403 for authenticated requests without permission.

-   [ ] Test authorization independently of UI visibility.

-   [ ] Prevent the LLM from deciding its own authorization privileges.

### 4.5 Application capabilities\*\*

-   [ ] Define structured application task requests.

-   [ ] Accept natural-language requirements for supported application
    tasks.

-   [ ] Generate application artifacts or structured responses.

-   [ ] Validate generated outputs deterministically.

-   [ ] Report validation errors clearly.

-   [ ] Separate generation, validation, and execution capabilities.

-   [ ] Require explicit authorization for privileged execution.

-   [ ] Do not execute generated commands or actions implicitly.

-   [ ] Add focused tests for application task behavior.

### 4.6 Administration capabilities\*\*

-   [ ] Add an admin-only demonstration page.

-   [ ] Display the current user's effective permissions.

-   [ ] Provide clear access-denied behavior for non-admin users.

-   \[DEFERRED\] Implement a full application user-management console.

-   \[DEFERRED\] Implement application-driven Keycloak user
    administration.

-   \[DEFERRED\] Implement application-driven role lifecycle management.

## 5. INTEGRATION\*\*

### 5.1 Next.js and Keycloak\*\*

-   [ ] Select and configure the Next.js OIDC session integration.

-   [ ] Configure the authorization-code callback.

-   [ ] Retrieve the confidential client secret securely on the server.

-   [ ] Validate the OIDC state and nonce as applicable to the chosen
    integration.

-   [ ] Configure callback and logout URLs.

-   [ ] Establish secure session-cookie settings.

-   [ ] Validate session expiry and refresh behavior where applicable.

-   [ ] Map trusted realm roles to application permissions.

-   [ ] Handle authentication failures without leaking credentials or
    tokens.

### 5.2 Protected API operations\*\*

-   [ ] Protect the AI API from unauthenticated requests.

-   [ ] Enforce permissions for every protected operation.

-   [ ] Return 401 for unauthenticated requests.

-   [ ] Return 403 for authenticated users without permission.

-   [ ] Test direct API calls that bypass the UI.

-   [ ] Validate request input and handle invalid input safely.

-   [ ] Ensure errors do not disclose secrets or internal configuration.

-   [ ] Apply rate limiting and abuse controls before production use.

### 5.3 UI and AI integration\*\*

-   [ ] Connect the authenticated UI to the existing AI endpoint.

-   [ ] Verify successful prompts and responses through the UI.

-   [ ] Verify loading and error handling.

-   [ ] Verify that protected requests require a valid session.

-   [ ] Verify that logout prevents subsequent protected access.

-   [ ] Verify that authorization failures do not invoke the AI agent.

-   [ ] Verify that provider credentials are not returned to the
    browser.

### 5.4 Runtime and persistence\*\*

-   [ ] Verify application startup with the documented commands.

-   [ ] Verify the existing AI integration after authentication changes.

-   [ ] Verify local service startup and restart behavior.

-   [ ] Verify persistent data survives ordinary container restarts.

-   [ ] Document safe recovery procedures.

-   [ ] Never delete existing volumes as part of routine validation.

## 6. EVOLUTION AND PRODUCTION READINESS\*\*

### Security\*\*

-   [ ] Configure production HTTPS.

-   [ ] Configure production Keycloak hostname and proxy settings.

-   [ ] Define secure production secret storage and rotation.

-   [ ] Define a production database strategy for Keycloak.

-   [ ] Establish session and token security requirements.

-   [ ] Establish authorization audit events.

-   [ ] Add security-focused tests.

-   [ ] Review dependency vulnerabilities.

-   [ ] Add rate limiting and abuse controls.

-   [ ] Review sensitive logging and error responses.

### Reliability and operations\*\*

-   [ ] Define production deployment procedures.

-   [ ] Define health checks and readiness behavior.

-   [ ] Define backup and recovery procedures.

-   [ ] Define monitoring and alerting requirements.

-   [ ] Document operational troubleshooting.

-   [ ] Test graceful handling of unavailable identity and AI services.

-   [ ] Establish a dependency update strategy.

### Future architecture\*\*

-   [ ] Evaluate tenant isolation if multi-tenancy becomes a
    requirement.

-   [ ] Evaluate policy-based authorization if role-based access becomes
    insufficient.

-   [ ] Evaluate an authorization audit view for administrators.

-   [ ] Add additional AI providers only when a clear reusable
    requirement exists.

-   [ ] Preserve provider-independent application abstractions.

-   [ ] Evaluate additional AI orchestration or workflow technologies
    only when justified.

## 7. BLOCKED\*\*

No confirmed blocker has been recorded in this checklist.

Items that require implementation or additional verification are
incomplete

work, not automatically blockers.

## 8. DEFERRED\*\*

-   \[DEFERRED\] Production Keycloak deployment and database
    configuration.

  Reason: validate the local integration before defining production
deployment.

-   \[DEFERRED\] Full user-management console.

  Reason: establish authentication and authorization before adding
lifecycle

  administration.

-   \[DEFERRED\] Multi-tenant identity and authorization.

  Reason: no concrete tenant-isolation requirements have been
established.

-   \[DEFERRED\] Privileged configuration execution.

  Reason: define authorization, validation, and execution safeguards
first.

-   \[DEFERRED\] Additional AI orchestration frameworks.

  Reason: add technology only when it delivers a justified reusable
capability.

## 9. OTHER / IDEAS\*\*

-   \[IDEA\] Add structured application task templates.

-   \[IDEA\] Add deterministic validation for generated artifacts.

-   \[IDEA\] Add role-aware capability discovery.

-   \[IDEA\] Add authorization audit visibility.

-   \[IDEA\] Evaluate tenant-aware permission models if required.

-   \[IDEA\] Evaluate additional provider adapters when justified by
    real use cases.

## 10. VALIDATION REQUIREMENTS\*\*

### Repository and documentation\*\*

-   [ ] Run `git diff --check`.

-   [ ] Verify the README clone URL.

-   [ ] Verify the repository license decision and `LICENSE` file.

-   [ ] Review all staged files before committing.

-   [ ] Confirm local environment files and real credentials are not
    staged.

### Application\*\*

-   [x] Run `pnpm exec tsc --noEmit` successfully.

-   [x] Run `pnpm lint` successfully.

-   [x] Run `pnpm test:archestra` successfully.

-   [ ] Run the production build and resolve any build errors.

-   [ ] Add and run authentication tests.

-   [ ] Add and run authorization tests.

-   [ ] Add and run protected API tests.

### Infrastructure\*\*

-   [x] Validate the Docker Compose configuration.

-   [x] Validate `setupscripts.sh` syntax.

-   [x] Validate the Keycloak realm JSON syntax.

-   [x] Verify local environment files are ignored by Git.

-   [ ] Verify running container health and readiness.

-   [ ] Verify the live Keycloak realm and OIDC client.

-   [ ] Verify live realm roles and OIDC discovery.

-   [ ] Verify persistent volumes remain intact.

-   [ ] Test the documented clean-start procedure without deleting
    existing data.

### Security\*\*

-   [x] Confirm `.env.local` and `.env.keycloak` are ignored by Git.

-   [ ] Inspect staged files for accidental secrets.

-   [ ] Verify no real credentials appear in tracked files or
    documentation.

-   [ ] Verify server-side authorization before declaring protected
    features complete.

-   [ ] Review production security requirements before deployment.

## 11. UPDATE DISCIPLINE\*\*

After every meaningful implementation increment:

1\. Record the files created or changed.

2\. Record the commands and tests executed.

3\. Mark an item complete only when the available evidence supports
completion.

4\. Distinguish configuration-file validation from live runtime
verification.

5\. Record new requirements in the appropriate section.

6\. Explain blockers and dependencies.

7\. Preserve architectural decisions and deferred work.

8\. Do not mark authentication, authorization, or production readiness
complete

  merely because the infrastructure configuration exists.

9\. Preserve existing Docker volumes and local credentials.

10\. Regenerate this entire file through the established `cat` heredoc
workflow

  whenever the master checklist needs an update.

## 12. VERIFIED STATUS & ROADMAP\*\*

### Current Verified Status

-   [x] **Unit Tests:** 15/15 tests passing across `role-access.test.ts` and `ai-test-request.test.ts`.
-   [x] **Type Safety:** `tsc --noEmit` clean with zero TypeScript errors.
-   [x] **Code Quality:** ESLint clean with zero errors.
-   [x] **Production Build:** Webpack production build passes cleanly.
-   [x] **OIDC Authentication:** NextAuth (Auth.js v5 beta) configured with Keycloak provider, PKCE code challenge, and federated logout.
-   [x] **Role-Based Access Control:** Realm roles (`viewer`, `developer`, `admin`) extracted into JWT session and enforced server-side.
-   [x] **AI Agent Integration:** Mastra agent configured to route requests through Archestra LLM gateway (`http://localhost:9000/v1`).
-   [x] **Identity Bootstrapping:** Local automated scripts for administrator (`bootstrap-keycloak-admin.sh`) and demo users (`bootstrap-keycloak-users.sh`), automatically executed during `pnpm docker:demo` via `scripts/docker-demo.mjs`.
-   [x] **Documentation Consolidaton:** Unified test credentials and development workflow in `README.md`.

### Next Milestones & Planned Capabilities

-   [ ] **In-App User Administration:** User management and role-assignment workflows directly within the application.
-   [ ] **Rate Limiting & Abuse Prevention:** Enforce token budgeting and request rate-limiting on protected AI endpoints.
-   [ ] **Production Hardening:** Production Keycloak deployment strategy, TLS configuration, reverse-proxy setup, and managed database.
-   [ ] **Open-Source License:** Select and include an open-source license (`LICENSE`) prior to public release.
