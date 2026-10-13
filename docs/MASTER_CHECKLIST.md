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
AI-powered

DevOps applications, including DevOps configuration generation and
validation.

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

-   [x] Reserve host port 9000 for the Archestra LLM proxy.

-   [x] Configure Keycloak to use host port 8080.

-   [x] Bind local development services to loopback where configured.

-   [x] Define Docker Compose services for the local environment.

-   [x] Configure persistent Docker volumes in the Compose definition.

-   [x] Preserve existing Archestra external volumes.

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

-   [ ] Create the login page.

-   [ ] Initiate login through Keycloak using OIDC authorization code
    flow.

-   [ ] Handle successful authentication and application return
    navigation.

-   [ ] Handle authentication errors.

-   [ ] Implement logout.

-   [ ] Protect authenticated application pages.

-   [ ] Display an appropriate unauthenticated state.

-   [ ] Test session expiry and logout behavior.

### 4.2 Application dashboard\*\*

-   [ ] Display the authenticated user's identity.

-   [ ] Display the effective application roles.

-   [ ] Provide role-aware navigation.

-   [ ] Display useful authorization-denied feedback.

-   [ ] Ensure the UI does not become the sole authorization control.

### 4.3 AI interaction UI\*\*

-   [ ] Add a prompt input and submit action.

-   [ ] Display the Mastra agent response.

-   [ ] Display loading and error states.

-   [ ] Connect the UI to the AI API.

-   [ ] Require authentication before accessing the protected AI
    operation.

-   [ ] Preserve the existing AI integration contract where practical.

-   [ ] Ensure confidential provider credentials never reach browser
    code.

### 4.4 Authorization model\*\*

-   [ ] Define a reusable application permission model.

-   [ ] Map trusted Keycloak roles to application permissions.

-   [ ] Define the initial capabilities available to `viewer`.

-   [ ] Define the initial capabilities available to `developer`.

-   [ ] Define the initial capabilities available to `admin`.

-   [ ] Enforce authorization on the server.

-   [ ] Return HTTP 401 for unauthenticated protected requests.

-   [ ] Return HTTP 403 for authenticated requests without permission.

-   [ ] Test authorization independently of UI visibility.

-   [ ] Prevent the LLM from deciding its own authorization privileges.

### 4.5 DevOps configuration capabilities\*\*

-   [ ] Define structured DevOps configuration-generation requests.

-   [ ] Accept natural-language requirements for supported configuration
    tasks.

-   [ ] Generate configuration artifacts.

-   [ ] Validate generated artifacts deterministically.

-   [ ] Report validation errors clearly.

-   [ ] Separate generation, validation, and execution capabilities.

-   [ ] Require explicit authorization for privileged execution.

-   [ ] Do not execute generated commands or configurations implicitly.

-   [ ] Add focused tests for configuration-generation behavior.

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

-   \[IDEA\] Add structured DevOps configuration templates.

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

## 12. LATEST VERIFIED STATUS\*\*

As of 2026-10-13:

-   [x] TypeScript check passed.

-   [x] ESLint passed.

-   [x] Mastra-to-Archestra-to-OpenRouter integration test passed.

-   [x] Expected integration success marker was returned.

-   [x] Docker Compose configuration validation passed.

-   [x] Keycloak realm JSON syntax validation passed.

-   [x] Setup script syntax validation passed.

-   [x] `.env.local` and `.env.keycloak` are ignored by Git.

-   [x] README and master checklist exist.

-   [ ] Production build has not yet been confirmed.

-   [ ] Complete OIDC login and server-side session handling remain
    outstanding.

-   [ ] Server-enforced RBAC remains outstanding.

-   [ ] Full live Keycloak realm/client/role verification remains
    outstanding.

-   [ ] First commit and GitHub publication remain outstanding.

-   [ ] Open-source license selection remains outstanding.

The successful AI integration is a verified foundation, not a claim that
the

entire application is production-ready.

## 13. CURRENT STATUS RECONCILIATION --- 2026-10-13

This section supersedes stale status statements elsewhere in this
checklist where newer terminal evidence is available. It does not mark
browser-based authentication as complete because a successful end-to-end
login has not yet been confirmed in the conversation.

### Confirmed by recent terminal evidence

-   [x] Keycloak container can be started with
    `docker compose up -d keycloak`.
-   [x] The `ai-starter` realm discovery endpoint responds at
    `http://localhost:8080/realms/ai-starter`.
-   [x] The `ai-starter-web` OIDC client redirect configuration passes
    the bootstrap script's verification.
-   [x] `scripts/bootstrap-keycloak-users.sh` completes successfully.
-   [x] `starter-developer` exists in the `ai-starter` realm and is
    enabled.
-   [x] `starter-viewer` exists in the `ai-starter` realm and is
    enabled.
-   [x] Both demo users have `requiredActions: []` in the live Keycloak
    response.
-   [x] The bootstrap script contains an explicit `requiredActions=[]`
    update.
-   [x] The `ai-starter-keycloak-data` Docker volume exists after
    recovery.
-   [x] Keycloak was restarted and recovered without deleting its data
    volume.
-   [x] The user-query verification issue was resolved by inspecting the
    raw `kcadm.sh get users` response; both filtered queries return
    their user.
-   [x] The Keycloak realm's discovery document reports the expected
    issuer and authorization endpoint.

### Implemented or partially implemented; end-to-end behavior still pending

-   \[\~\] NextAuth/Keycloak provider configuration exists in
    `src/auth.ts`.
-   \[\~\] The NextAuth route exists at
    `src/app/api/auth/[...nextauth]/route.ts`.
-   \[\~\] Sign-in and sign-out UI/actions and a Keycloak logout route
    have been added or modified during the current work.
-   \[\~\] Role extraction from Keycloak claims is present in the auth
    configuration.
-   [ ] Confirm successful browser login for `starter-viewer` without a
    forced password-reset prompt.
-   [ ] Confirm successful browser login for `starter-developer`.
-   [ ] Confirm logout clears the application session and performs
    top-level navigation to Keycloak logout without the previously
    observed CORS error.
-   [ ] Confirm session expiry and unauthenticated states in the
    browser.
-   [ ] Confirm the application displays the expected identity and role
    for each demo account.

### Still incomplete

-   [ ] Application-level admin account creation and admin-only page.
-   [ ] Server-side authorization enforcement for the AI API and every
    protected operation.
-   [ ] Automated tests for login, logout, role mapping, and protected
    APIs.
-   [ ] Browser verification of the complete OIDC authorization-code
    flow.
-   [ ] Production build verification after current authentication
    changes.
-   [ ] Revalidation of the complete test suite after current
    authentication changes.
-   [ ] Safe clean-start procedure documented and tested without
    deleting unrelated volumes.
-   [ ] Repository URL and license decisions.

### Operational note

The earlier user-verification command incorrectly reported "User not
found" because its parsing expected a JSON object, while
`kcadm.sh get users` returns a JSON array. Subsequent raw and filtered
queries confirmed that both accounts exist. Do not recreate the users or
delete the Keycloak volume to address that verification-script issue.

The Keycloak data volume was identified as `ai-starter-keycloak-data`
and remained present during recovery. No successful volume deletion was
reported. Preserve that volume and all Archestra/PostgreSQL volumes
during ordinary validation.

## 14. PRIORITIZED NEXT TASKS

Use this ordering for the next implementation increments. Do not start
lower priority work until the current acceptance criteria are met.

### P0 --- Finish and verify authentication first

-   [ ] **P0.1** Test `starter-viewer` in a private browser window at
    `http://localhost:3001`; verify it signs in without a password-reset
    prompt.
-   [ ] **P0.2** Test `starter-developer` the same way.
-   [ ] **P0.3** Verify the app shows the correct authenticated identity
    and role.
-   [ ] **P0.4** Test sign-out; confirm both the app session and
    Keycloak session behavior are correct and no CORS/`next-action`
    error occurs.
-   [ ] **P0.5** If a password-reset prompt remains despite
    `requiredActions: []`, inspect the live realm authentication flows
    and user credential state before changing the realm or resetting any
    volume.
-   [ ] **P0.6** Run `pnpm check` (or the repository's documented
    equivalent) and resolve regressions caused by auth changes.

**P0 acceptance criteria:** both demo accounts can complete the browser
login flow without an unexpected forced password reset; logout works; no
auth-related TypeScript/lint/test failures remain.

### P1 --- Enforce server-side authorization

-   [ ] **P1.1** Define the application permission model for `viewer`,
    `developer`, and `admin`.
-   [ ] **P1.2** Confirm the role claims are sourced from trusted
    Keycloak tokens and mapped consistently to application permissions.
-   [ ] **P1.3** Protect the AI API on the server; do not rely on hidden
    UI controls.
-   [ ] **P1.4** Return HTTP 401 for requests without a valid session
    and HTTP 403 for authenticated users without permission.
-   [ ] **P1.5** Test direct API requests that bypass the UI.
-   [ ] **P1.6** Ensure rejected requests do not invoke the Mastra agent
    or incur model-provider usage.
-   [ ] **P1.7** Add automated authorization tests for allowed and
    denied roles.

**P1 acceptance criteria:** protected operations enforce authorization
at the server boundary and direct requests cannot bypass it.

### P1 --- Complete the authenticated AI interaction

-   [ ] **P1.8** Connect the authenticated UI to the existing AI API
    contract.
-   [ ] **P1.9** Verify loading, success, invalid-input, and error
    states.
-   [ ] **P1.10** Verify provider credentials and tokens are never
    exposed to the browser or returned in API responses.
-   [ ] **P1.11** Confirm unauthorized requests are rejected before AI
    execution.

### P2 --- Stabilize, validate, and document

-   [ ] **P2.1** Run TypeScript checks, lint, unit tests, integration
    tests, and production build after auth/RBAC changes.
-   [ ] **P2.2** Revalidate `docker compose config --quiet`, Keycloak
    readiness, realm discovery, client redirect settings, and role
    configuration.
-   [ ] **P2.3** Verify ordinary container restarts preserve Keycloak
    and Archestra data; document safe recovery steps.
-   [ ] **P2.4** Review `git diff --check` and `git status --short`.
-   [ ] **P2.5** Review tracked and staged files for secrets; do not
    print or commit `.env.local` or `.env.keycloak`.
-   [ ] **P2.6** Confirm the GitHub repository URL, replace README
    placeholders, and select an appropriate open-source license.

### Deferred until foundational auth/RBAC works

-   \[DEFERRED\] Create a dedicated application `starter-admin` account
    and assign the application admin role. This is not the Keycloak
    `master` realm admin.
-   \[DEFERRED\] Build a full application user-management console.
-   \[DEFERRED\] Implement application-driven Keycloak user/role
    administration.
-   \[DEFERRED\] Production Keycloak deployment, TLS, production
    database, and production secret-management setup.
-   \[DEFERRED\] Multi-tenancy and privileged configuration execution.

## 15. WORKING RULES FOR THE NEXT SESSION

1.  Inspect the current file before replacing it; preserve unrelated
    edits.
2.  Prefer small, reviewable changes and run focused validation after
    each change.
3.  Never delete Docker volumes as routine troubleshooting.
4.  Never use `docker compose down -v` for this project.
5.  Do not reset demo or administrator passwords unless the specific
    operation is intentional and its effect is understood.
6.  Treat configuration-file presence, command success, and browser
    behavior as different levels of evidence.
7.  Mark an item complete only after its stated acceptance criteria have
    been observed.
8.  Keep the application admin account deferred until login, logout, and
    server-side authorization foundations are verified.
