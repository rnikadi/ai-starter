#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
process.env.COMPOSE_PROJECT_NAME =
  process.env.COMPOSE_PROJECT_NAME || pkg.name || "ai-starter";

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
      "Docker is not running or not accessible. Infrastructure & observability (:8080, :9000, :3002, :9090) will NOT be started.",
    );
    warn("Please start Docker Desktop if you plan to sign in, test AI connectivity, or inspect telemetry.\n");
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

  // Ensure host logs directory and initial log files exist for Promtail volume mount
  fs.mkdirSync("logs", { recursive: true });
  for (const file of ["backend.log", "frontend.log", "dev.log"]) {
    const logPath = path.join("logs", file);
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, "");
    }
  }

  log("Starting infrastructure and observability containers (docker compose --profile monitoring up -d)...");
  try {
    const envFileArgs = fs.existsSync(".env.local")
      ? "--env-file .env --env-file .env.local"
      : fs.existsSync(".env")
        ? "--env-file .env"
        : "";
    const composeCmd = `docker compose ${envFileArgs} --profile monitoring up -d`.trim();
    execSync(composeCmd, { stdio: "inherit" });
    log(`${GREEN}✓ Supporting infrastructure and observability containers are running.${RESET}\n`);
  } catch (err) {
    error("Failed to start Docker containers with docker compose --profile monitoring up -d.");
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
  console.log(`  ${BOLD}Grafana Observability:${RESET} http://localhost:3002 (admin/admin)`);
  console.log(`  ${BOLD}Prometheus Metrics:${RESET}    http://localhost:9090`);
  console.log(`  ${BOLD}Loki Log Aggregation:${RESET}  http://localhost:3002 (Loki Explore)`);
  console.log(`  ${BOLD}Tempo Traces:${RESET}          http://localhost:3002 (Tempo Explore)`);
  console.log(`  ${BOLD}Host Logs (Piped):${RESET}     logs/backend.log & logs/frontend.log -> Promtail`);
  console.log(`${BOLD}====================================================${RESET}`);
  console.log(`  Press ${BOLD}Ctrl+C${RESET} to stop ONLY the frontend & backend dev servers.`);
  console.log(`  (Infrastructure and observability containers will remain running for fast restart)`);
  console.log(`  To stop Docker containers later, run: ${CYAN}pnpm dev:down${RESET}`);
  console.log(`  To run full containerized demo with Grafana: ${CYAN}pnpm docker:demo${RESET}\n`);
}

// 3. Spawn child processes
const children = [];

function spawnProcess(command, args, label, color, logFiles = []) {
  const child = spawn(command, args, {
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    env: { ...process.env },
  });

  children.push(child);

  const streams = logFiles.map((file) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return fs.createWriteStream(file, { flags: "a" });
  });

  // Strip ANSI color escape sequences from log files so Loki gets clean text or JSON
  const stripAnsi = (str) =>
    str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    const cleanText = stripAnsi(chunk.toString("utf8"));
    for (const stream of streams) {
      stream.write(cleanText);
    }
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    const cleanText = stripAnsi(chunk.toString("utf8"));
    for (const stream of streams) {
      stream.write(cleanText);
    }
  });

  child.on("exit", (code, signal) => {
    for (const stream of streams) {
      stream.end();
    }
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

const backend = spawnProcess("pnpm", ["dev:backend"], "backend", CYAN, [
  "logs/backend.log",
  "logs/dev.log",
]);
const frontend = spawnProcess("pnpm", ["dev:frontend"], "frontend", GREEN, [
  "logs/frontend.log",
  "logs/dev.log",
]);

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
    `${YELLOW}[dev-runner]${RESET} Note: Docker infrastructure & observability containers are still running. To stop them, run: ${CYAN}pnpm dev:down${RESET}\n`,
  );

  process.exit(0);
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

