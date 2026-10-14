#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function log(msg) {
  console.log(`${CYAN}[dev-runner]${RESET} ${msg}`);
}

function warn(msg) {
  console.warn(`${YELLOW}[dev-runner:warn]${RESET} ${msg}`);
}

function error(msg) {
  console.error(`${RED}[dev-runner:error]${RESET} ${msg}`);
}

// 1. Check Docker & Start Infrastructure
function ensureDockerInfrastructure() {
  log("Checking Docker Desktop status...");

  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    warn(
      "Docker is not running or not accessible. Keycloak (:8080) and Archestra (:9000/:3000) will NOT be started.",
    );
    warn("Please start Docker Desktop if you plan to sign in or test AI connectivity.\n");
    return;
  }

  if (!fs.existsSync(".env") || !fs.existsSync(".env.keycloak")) {
    log("Required environment files are missing. Running ./setupscripts.sh...");
    try {
      execSync("./setupscripts.sh", { stdio: "inherit" });
    } catch {
      warn("Failed to run ./setupscripts.sh automatically.");
    }
  }

  log("Starting PostgreSQL, Keycloak, and Archestra infrastructure (docker compose up -d)...");
  try {
    execSync("docker compose up -d", { stdio: "inherit" });
    log(`${GREEN}✓ Supporting infrastructure containers are running.${RESET}\n`);
  } catch (err) {
    error("Failed to start Docker containers with docker compose up -d.");
    warn("Continuing to start frontend and backend anyway...\n");
  }
}

// 2. Display Service Dashboard
function printDashboard() {
  console.log(`${BOLD}====================================================${RESET}`);
  console.log(`  ${BOLD}${GREEN}AI Starter Services${RESET}`);
  console.log(`${BOLD}====================================================${RESET}`);
  console.log(`  ${BOLD}Frontend Web UI:${RESET}       http://localhost:3001`);
  console.log(`  ${BOLD}Backend API:${RESET}           http://localhost:4000`);
  console.log(`  ${BOLD}API Documentation:${RESET}     http://localhost:4000/docs`);
  console.log(`  ${BOLD}Health Probes:${RESET}         http://localhost:4000/healthz & /readyz`);
  console.log(`  ${BOLD}Keycloak Auth:${RESET}         http://localhost:8080 (Realm: ai-starter)`);
  console.log(`  ${BOLD}Archestra Gateway:${RESET}     http://localhost:9000 (UI: :3000)`);
  console.log(`  ${BOLD}PostgreSQL (pgvector):${RESET} localhost:5432 (DB: aistarter_db)`);
  console.log(`${BOLD}====================================================${RESET}`);
  console.log(`  Press ${BOLD}Ctrl+C${RESET} to stop ONLY the frontend & backend dev servers.`);
  console.log(`  (PostgreSQL, Keycloak, and Archestra will remain running for fast restart)`);
  console.log(`  To stop Docker containers later, run: ${CYAN}pnpm dev:down${RESET}`);
  console.log(`  To run full containerized demo with Grafana: ${CYAN}pnpm docker:demo${RESET}\n`);
}

// 3. Spawn child processes
const children = [];

function spawnProcess(command, args, label, color) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (signal) {
      log(`${color}${label}${RESET} exited due to signal ${signal}`);
    } else if (code !== 0 && code !== null) {
      error(`${color}${label}${RESET} exited with code ${code}`);
    }
  });

  return child;
}

// 4. Main
ensureDockerInfrastructure();
printDashboard();

const backend = spawnProcess("pnpm", ["dev:backend"], "backend", CYAN);
const frontend = spawnProcess("pnpm", ["dev:frontend"], "frontend", GREEN);

// 5. Graceful Shutdown on Ctrl+C / SIGINT
function handleShutdown() {
  console.log(`\n${CYAN}[dev-runner]${RESET} Stopping application servers...`);

  for (const child of children) {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  console.log(`${GREEN}[dev-runner]${RESET} Frontend and backend servers stopped.`);
  console.log(
    `${YELLOW}[dev-runner]${RESET} Note: Docker containers are still running. To stop them, run: ${CYAN}pnpm dev:down${RESET}\n`,
  );

  process.exit(0);
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

