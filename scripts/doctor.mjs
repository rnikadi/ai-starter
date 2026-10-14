#!/usr/bin/env node

/**
 * AI Starter Platform Health & Environment Diagnostic CLI (pnpm doctor)
 * Performs end-to-end verification of runtime prerequisites, environment configs,
 * Docker daemon, container states, PostgreSQL + pgvector, Keycloak OIDC,
 * Archestra LLM Gateway, and Observability ports (Prometheus, Loki, Tempo, Grafana).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import process from "node:process";
import postgres from "postgres";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

const PASS = `${GREEN}✔ PASS${RESET}`;
const WARN = `${YELLOW}⚠ WARN${RESET}`;
const FAIL = `${RED}✖ FAIL${RESET}`;

let failureCount = 0;
let warningCount = 0;
let passCount = 0;
const remediations = [];

function recordPass(category, message, detail = "") {
  passCount++;
  console.log(`  ${PASS} [${category}] ${message}${detail ? ` ${DIM}(${detail})${RESET}` : ""}`);
}

function recordWarn(category, message, remediation = "") {
  warningCount++;
  console.log(`  ${WARN} [${category}] ${message}`);
  if (remediation) {
    remediations.push(`[${category}] ${remediation}`);
  }
}

function recordFail(category, message, remediation = "") {
  failureCount++;
  console.log(`  ${FAIL} [${category}] ${message}`);
  if (remediation) {
    remediations.push(`[${category}] ${remediation}`);
  }
}

async function checkPortTcp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function checkHttpEndpoint(url, timeoutMs = 2500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

console.log(`\n${BOLD}${CYAN}=== AI Starter Platform Diagnostic Doctor ===${RESET}\n`);

// 1. Runtime & CLI Tools
console.log(`${BOLD}1. Runtime & Tooling Prerequisites:${RESET}`);
const nodeVer = process.version;
const majorNode = parseInt(nodeVer.replace("v", "").split(".")[0], 10);
if (majorNode >= 20) {
  recordPass("Runtime", `Node.js ${nodeVer}`, "Required >= 20.0.0");
} else {
  recordFail("Runtime", `Node.js version ${nodeVer} is unsupported.`, "Install Node.js 20 LTS or higher.");
}

try {
  const pnpmVer = execSync("pnpm -v", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  recordPass("Runtime", `pnpm v${pnpmVer}`, "Package manager available");
} catch {
  recordFail("Runtime", "pnpm is not installed or not in PATH.", "Install pnpm using 'npm install -g pnpm'.");
}

let dockerRunning = false;
try {
  execSync("docker info", { stdio: "ignore" });
  dockerRunning = true;
  recordPass("Docker", "Docker daemon is running and responsive.");
} catch {
  recordFail(
    "Docker",
    "Docker daemon is not running.",
    "Start Docker Desktop or your Docker daemon service.",
  );
}

// 2. Configuration & Environment Files
console.log(`\n${BOLD}2. Environment & Secret Configurations:${RESET}`);
const envFiles = [
  { file: ".env", required: false },
  { file: ".env.local", required: true },
  { file: ".env.keycloak", required: true },
];

for (const { file, required } of envFiles) {
  if (fs.existsSync(file)) {
    recordPass("Config", `File '${file}' exists.`);
  } else if (required) {
    recordFail("Config", `Required environment file '${file}' is missing.`, "Run './setupscripts.sh' to initialize environment configurations.");
  } else {
    recordWarn("Config", `Optional file '${file}' is not present.`);
  }
}

// Load and parse .env.local variables
let envConfig = {};
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        envConfig[k] = v;
      }
    }
  }
}

const dbUrl = envConfig.DATABASE_URL || process.env.DATABASE_URL || "postgresql://aistarter:aistarter_local_secret@localhost:5432/aistarter_db";
const archestraKey = envConfig.ARCHESTRA_VIRTUAL_KEY || process.env.ARCHESTRA_VIRTUAL_KEY;
const archestraBase = envConfig.ARCHESTRA_BASE_URL || process.env.ARCHESTRA_BASE_URL;
const archestraModel = envConfig.ARCHESTRA_MODEL || process.env.ARCHESTRA_MODEL;
const archestraEmbed = envConfig.ARCHESTRA_EMBEDDING_MODEL || process.env.ARCHESTRA_EMBEDDING_MODEL || "nvidia/nemotron-3-embed-1b:free";

if (archestraKey && archestraBase) {
  recordPass("Config", "Archestra Gateway credentials configured.", `Base: ${archestraBase}`);
  if (archestraModel) {
    recordPass("Config", `LLM Model configured`, archestraModel);
  }
  recordPass("Config", `Embedding Model configured`, archestraEmbed);
} else {
  recordWarn(
    "Config",
    "Archestra Gateway credentials incomplete.",
    "Verify ARCHESTRA_VIRTUAL_KEY and ARCHESTRA_BASE_URL in .env.local",
  );
}

// 3. Docker Containers Status (if Docker is running)
if (dockerRunning) {
  console.log(`\n${BOLD}3. Container Infrastructure Status:${RESET}`);
  const targetContainers = [
    { name: "ai-starter-postgres", critical: true },
    { name: "ai-starter-keycloak", critical: true },
    { name: "ai-starter-archestra", critical: true },
    { name: "ai-starter-prometheus", critical: false },
    { name: "ai-starter-loki", critical: false },
    { name: "ai-starter-tempo", critical: false },
    { name: "ai-starter-grafana", critical: false },
    { name: "ai-starter-promtail", critical: false },
  ];

  try {
    const psOutput = execSync('docker ps --format "{{.Names}}\t{{.Status}}"', {
      encoding: "utf8",
    });
    const runningMap = new Map();
    for (const line of psOutput.trim().split("\n")) {
      if (!line.trim()) continue;
      const [name, status] = line.split("\t");
      runningMap.set(name, status);
    }

    for (const c of targetContainers) {
      if (runningMap.has(c.name)) {
        const status = runningMap.get(c.name);
        recordPass("Container", `${c.name}`, status);
      } else if (c.critical) {
        recordFail(
          "Container",
          `Container '${c.name}' is not running.`,
          "Run 'pnpm infra:up' to launch essential infrastructure.",
        );
      } else {
        recordWarn(
          "Container",
          `Monitoring container '${c.name}' is stopped.`,
          "Run 'pnpm monitoring:up' to start the observability stack.",
        );
      }
    }
  } catch (err) {
    recordWarn("Container", "Could not query docker ps.", String(err));
  }
}

// 4. PostgreSQL & pgvector Extension Verification
console.log(`\n${BOLD}4. Database & pgvector Extension Diagnostics:${RESET}`);
const pgPortOpen = await checkPortTcp("localhost", 5432);
if (!pgPortOpen) {
  recordFail(
    "Database",
    "PostgreSQL TCP port 5432 is unreachable on localhost.",
    "Ensure the postgres container is up with 'pnpm infra:up'.",
  );
} else {
  recordPass("Database", "PostgreSQL port 5432 is accepting connections.");

  let sqlClient;
  try {
    sqlClient = postgres(dbUrl, { connect_timeout: 3, max: 1 });
    await sqlClient`SELECT 1 as connected`;
    recordPass("Database", "PostgreSQL credentials and connection verified.");

    // Query pgvector extension
    const extRows = await sqlClient`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`;
    if (extRows.length > 0) {
      recordPass("Database", `pgvector extension is active`, `v${extRows[0].extversion}`);
    } else {
      recordWarn(
        "Database",
        "pgvector extension is not registered in the target database.",
        "Run 'CREATE EXTENSION IF NOT EXISTS vector;' in PostgreSQL or restart container.",
      );
    }

    // Check if tables exist
    const tables = await sqlClient`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('conversations', 'messages', 'documents')
    `;
    const tableNames = tables.map((t) => t.table_name);
    if (tableNames.includes("conversations") && tableNames.includes("documents")) {
      recordPass("Database", `Drizzle schema tables present`, tableNames.join(", "));
    } else {
      recordWarn(
        "Database",
        `Database tables missing (Found: [${tableNames.join(", ")}])`,
        "Run 'pnpm db:migrate' to apply database migrations.",
      );
    }
  } catch (dbErr) {
    recordWarn(
      "Database",
      `Database connection query failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
      "Check DATABASE_URL credentials in .env.local",
    );
  } finally {
    if (sqlClient) {
      await sqlClient.end({ timeout: 1 });
    }
  }
}

// 5. Service & Observability Health Endpoints
console.log(`\n${BOLD}5. Service & Observability Endpoints:${RESET}`);
const endpoints = [
  { name: "Backend API Health", url: "http://localhost:4000/healthz", critical: false },
  { name: "Keycloak OIDC Discovery", url: "http://localhost:8080/realms/ai-starter/.well-known/openid-configuration", critical: true },
  { name: "Prometheus Health", url: "http://localhost:9090/-/healthy", critical: false },
  { name: "Loki Readiness", url: "http://localhost:3100/ready", critical: false },
  { name: "Tempo Readiness", url: "http://localhost:3200/ready", critical: false },
  { name: "Grafana Health", url: "http://localhost:3002/api/health", critical: false },
];

for (const ep of endpoints) {
  const res = await checkHttpEndpoint(ep.url);
  if (res.ok) {
    recordPass("Service", `${ep.name}`, `HTTP ${res.status}`);
  } else if (ep.critical) {
    recordFail(
      "Service",
      `${ep.name} unreachable at ${ep.url}`,
      "Ensure container is running and healthy via 'pnpm infra:up'.",
    );
  } else {
    recordWarn(
      "Service",
      `${ep.name} unavailable at ${ep.url}`,
      "Start service or monitoring stack ('pnpm monitoring:up' or 'pnpm dev:backend').",
    );
  }
}

// 6. Summary and Actionable Remediations
console.log(`\n${BOLD}=== Diagnostic Summary ===${RESET}`);
console.log(`  Passed Checks:   ${GREEN}${passCount}${RESET}`);
console.log(`  Warnings:        ${YELLOW}${warningCount}${RESET}`);
console.log(`  Critical Issues: ${failureCount > 0 ? RED : GREEN}${failureCount}${RESET}`);

if (remediations.length > 0) {
  console.log(`\n${BOLD}${YELLOW}Recommended Remediation Steps:${RESET}`);
  const uniqueRemediations = Array.from(new Set(remediations));
  uniqueRemediations.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item}`);
  });
}

if (failureCount === 0) {
  console.log(`\n${BOLD}${GREEN}✔ Platform environment is ready!${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${BOLD}${RED}✖ Platform diagnostic encountered ${failureCount} critical issue(s). Follow remediations above.${RESET}\n`);
  process.exit(1);
}

