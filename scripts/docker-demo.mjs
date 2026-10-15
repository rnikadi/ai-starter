#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

import { syncKeycloak, toDisplayName } from "./sync-keycloak.mjs";

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
process.env.COMPOSE_PROJECT_NAME =
  process.env.COMPOSE_PROJECT_NAME || pkg.name;

syncKeycloak();

function log(msg) {
  console.log(`${CYAN}[docker-demo]${RESET} ${msg}`);
}

function success(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function warn(msg) {
  console.warn(`${YELLOW}[docker-demo:warn]${RESET} ${msg}`);
}

function error(msg) {
  console.error(`${RED}[docker-demo:error]${RESET} ${msg}`);
}

// 1. Check Docker status
function checkDocker() {
  log("Checking Docker Desktop status...");
  try {
    execSync("docker info", { stdio: "ignore" });
    success("Docker daemon is running.");
  } catch {
    error("Docker is not running or not accessible. Please start Docker Desktop and retry.");
    process.exit(1);
  }
}

// 2. Ensure environment prerequisites
function ensureEnvironment() {
  if (!fs.existsSync(".env") || !fs.existsSync(".env.keycloak") || !fs.existsSync(".env.local")) {
    log("Required environment files are missing. Running ./setupscripts.sh...");
    try {
      execSync("./setupscripts.sh", { stdio: "inherit" });
      success("Environment configuration prepared.");
    } catch (err) {
      error("Failed to run ./setupscripts.sh.");
      process.exit(1);
    }
  } else {
    success("Environment configuration files verified.");
  }
}

// 3. Stage 1: Launch PostgreSQL database as first priority
function startPostgresFirst() {
  const envFileArgs = fs.existsSync(".env.local")
    ? "--env-file .env --env-file .env.local"
    : "--env-file .env";

  log("Stage 1/3: Starting PostgreSQL database container as first priority...");
  try {
    execSync(`docker compose ${envFileArgs} up -d postgres`, { stdio: "inherit" });
  } catch {
    error("Failed to start PostgreSQL container.");
    process.exit(1);
  }

  process.stdout.write(`${CYAN}[docker-demo]${RESET} Waiting for PostgreSQL healthcheck (pg_isready)... `);
  const maxRetries = 30;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      execSync("docker compose exec postgres pg_isready -U aistarter -d aistarter_db", {
        stdio: "ignore",
      });
      console.log(`${GREEN}Healthy!${RESET}`);
      return;
    } catch {
      // Waiting for postgres
    }
    execSync("sleep 1");
  }
  warn("PostgreSQL initialization took longer than expected, continuing with startup...");
}

// 4. Stage 2: Apply database migrations
function applyDatabaseMigrations() {
  log("Stage 2/3: Applying PostgreSQL migrations via Drizzle ORM...");
  try {
    execSync("pnpm db:migrate", { stdio: "inherit" });
    success("Database schema verified and migrations applied.");
  } catch {
    warn("Database migration via local CLI skipped (will run inside backend container).");
  }
}

// 5. Stage 3: Launch remaining supporting infrastructure and application containers
function startRemainingStack() {
  const shouldBuild = !process.argv.includes("--no-build");
  const envFileArgs = fs.existsSync(".env.local")
    ? "--env-file .env --env-file .env.local"
    : "--env-file .env";
  const cmd = `docker compose ${envFileArgs} --profile full up -d ${shouldBuild ? "--build" : ""}`.trim();

  log(
    shouldBuild
      ? "Stage 3/3: Building and starting application and supporting containers (docker compose --profile full up -d --build)..."
      : "Stage 3/3: Starting application and supporting containers (docker compose --profile full up -d)...",
  );

  try {
    execSync(cmd, { stdio: "inherit" });
    success("All stack containers launched via Docker Compose.");
  } catch {
    error("Failed to start Docker Compose full profile.");
    process.exit(1);
  }
}

// 4. HTTP Health Probe helper
async function waitForHttp(url, name, maxRetries = 45, intervalMs = 2000) {
  process.stdout.write(`${CYAN}[docker-demo]${RESET} Waiting for ${name} (${url})... `);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        console.log(`${GREEN}Ready!${RESET}`);
        return true;
      }
    } catch {
      // Waiting for service to respond
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  console.log(`${YELLOW}Timed out waiting for response.${RESET}`);
  return false;
}

// 5. Bootstrap Keycloak users and administration
function runBootstrapScripts() {
  if (process.argv.includes("--no-bootstrap")) {
    log("Skipping bootstrap scripts (--no-bootstrap specified).");
    return;
  }

  log("Starting identity & user bootstrapping...");

  try {
    log("Executing Keycloak admin bootstrap (./scripts/bootstrap-keycloak-admin.sh)...");
    execSync("./scripts/bootstrap-keycloak-admin.sh", {
      stdio: "inherit",
      env: { ...process.env, STARTER_ADMIN_RESET_PASSWORD: "true" },
    });
    success("Keycloak administrator account verified.");
  } catch (err) {
    error("Failed to execute ./scripts/bootstrap-keycloak-admin.sh.");
    process.exit(1);
  }

  try {
    log("Executing Keycloak demo users bootstrap (./scripts/bootstrap-keycloak-users.sh)...");
    execSync("./scripts/bootstrap-keycloak-users.sh", {
      stdio: "inherit",
      env: { ...process.env },
    });
    success("Keycloak demo users and OIDC redirect configuration verified.");
  } catch (err) {
    error("Failed to execute ./scripts/bootstrap-keycloak-users.sh.");
    process.exit(1);
  }
}

// 6. Print Demo Dashboard
function printDashboard() {
  const displayName = toDisplayName(pkg.name);
  console.log(`\n${BOLD}================================================================${RESET}`);
  console.log(`  ${BOLD}${GREEN}${displayName} - Full Containerized Demo & Observability${RESET}`);
  console.log(`${BOLD}================================================================${RESET}`);
  console.log(`  ${BOLD}Frontend Web UI:${RESET}       http://localhost:3001`);
  console.log(`  ${BOLD}Backend API:${RESET}           http://localhost:4000`);
  console.log(`  ${BOLD}API Documentation:${RESET}     http://localhost:4000/docs`);
  console.log(`  ${BOLD}Health Probes:${RESET}         http://localhost:4000/healthz & /readyz`);
  console.log(`  ${BOLD}Keycloak Console:${RESET}      http://localhost:8080 (Realm: ai-starter)`);
  console.log(`  ${BOLD}Archestra Gateway:${RESET}     http://localhost:9000 (UI: http://localhost:3000)`);
  console.log(`  ${BOLD}PostgreSQL (pgvector):${RESET} localhost:5432 (DB: aistarter_db, Drizzle ORM)`);
  console.log(`  ${BOLD}Grafana Observability:${RESET} http://localhost:3002 (Default login: admin / admin)`);
  console.log(`  ${BOLD}Loki Log Aggregator:${RESET}   http://localhost:3100`);
  console.log(`  ${BOLD}Prometheus Metrics:${RESET}    http://localhost:9090`);
  console.log(`${BOLD}================================================================${RESET}`);
  console.log(`  ${BOLD}${CYAN}Provisioned Local Demo Accounts:${RESET}`);
  console.log(`    • Developer:  ${BOLD}developer${RESET} / ${BOLD}password${RESET}  (AI testing & prompt execution)`);
  console.log(`    • Viewer:     ${BOLD}viewer${RESET}    / ${BOLD}password${RESET}  (Read-only dashboard access)`);
  console.log(`    • Admin:      ${BOLD}admin${RESET}     / ${BOLD}password${RESET}  (Administrative console & status)`);
  console.log(`${BOLD}================================================================${RESET}`);
  console.log(`  ${BOLD}Quick Commands:${RESET}`);
  console.log(`    • View container status:   ${CYAN}pnpm docker:status${RESET}`);
  console.log(`    • Stop ONLY app containers: ${CYAN}pnpm docker:demo:app:down${RESET} (keeps DB & infra running)`);
  console.log(`    • Restart app containers:  ${CYAN}pnpm docker:demo:app:restart${RESET}`);
  console.log(`    • View service logs:       ${CYAN}docker compose --profile full logs -f [service]${RESET}`);
  console.log(`    • Stop all demo services:  ${CYAN}pnpm docker:down${RESET}`);
  console.log(`${BOLD}================================================================${RESET}\n`);
}

// Main workflow
async function main() {
  checkDocker();
  ensureEnvironment();

  // Stage 1: Database first priority
  startPostgresFirst();

  // Stage 2: Database schema migrations
  applyDatabaseMigrations();

  // Stage 3: Supporting infrastructure & application stack
  startRemainingStack();

  // Wait for Keycloak realm discovery endpoint to be ready before running bootstrap scripts
  await waitForHttp(
    "http://localhost:8080/realms/ai-starter/.well-known/openid-configuration",
    "Keycloak Realm Discovery",
    60,
    2000,
  );

  // Run the bootstrap scripts to ensure all accounts and redirect URIs are configured
  runBootstrapScripts();

  // Wait for Frontend, Backend, and Observability services
  await Promise.all([
    waitForHttp("http://localhost:4000/healthz", "Backend API Health Probe", 30, 1500),
    waitForHttp("http://localhost:3001/api/healthz", "Frontend Next.js Health Probe", 30, 1500),
    waitForHttp("http://localhost:3002/api/health", "Grafana Observability", 30, 1500),
  ]);

  printDashboard();
}

main().catch((err) => {
  error(`Demo runner failed: ${err.message}`);
  process.exit(1);
});

