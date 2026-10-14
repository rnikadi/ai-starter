import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createBackendServer } from "./server.js";

const envPath = fs.existsSync(".env.local")
  ? path.resolve(".env.local")
  : path.resolve("..", ".env.local");

dotenv.config({ path: envPath });

import { getBackendEnv } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { initTracing, shutdownTracing } from "./lib/tracing.js";

// Initialize OpenTelemetry Tracing
initTracing();

const env = getBackendEnv();
const port = env.PORT || env.BACKEND_PORT;
const host = env.HOST;

// Auto-apply PostgreSQL migrations on startup if database is accessible
try {
  await runMigrations();
} catch (err) {
  console.warn(
    "[backend] Notice: Database migrations skipped or failed on startup:",
    err instanceof Error ? err.message : err,
  );
}

const server = createBackendServer();
const publicUrl =
  env.BACKEND_PUBLIC_URL ||
  `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;

server.listen(port, host, () => {
  console.log(`\n========================================`);
  console.log(`  AI Starter Backend API Server`);
  console.log(`  Listening at:     ${publicUrl}`);
  console.log(`  API Docs:         ${publicUrl}/docs`);
  console.log(`  OpenAPI Spec:     ${publicUrl}/openapi.json`);
  console.log(`  Liveness Probe:   ${publicUrl}/healthz`);
  console.log(`  Readiness Probe:  ${publicUrl}/readyz`);
  console.log(`  Metrics (Prom):   ${publicUrl}/metrics`);
  console.log(`  Traces (OTLP):    Tempo (:4318 OTLP / :3200 Query)`);
  console.log(`========================================\n`);
});

let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[backend] Received ${signal}. Initiating graceful shutdown...`);

  // Close idle connections immediately to allow active requests to finish
  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }

  // Force shutdown after timeout in case hanging requests persist
  const forceExitTimer = setTimeout(() => {
    console.error("[backend] Graceful shutdown timed out after 10s. Forcing exit.");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) {
      console.error("[backend] Error closing HTTP server:", err);
    } else {
      console.log("[backend] HTTP server stopped accepting connections.");
    }

    try {
      const { closeDb } = await import("./db/index.js");
      await closeDb();
      console.log("[backend] Database connection pool closed.");
    } catch {
      // Ignore if db wasn't connected
    }

    try {
      await shutdownTracing();
      console.log("[backend] OpenTelemetry traces flushed.");
    } catch {
      // Ignore if tracing wasn't active
    }

    clearTimeout(forceExitTimer);
    console.log("[backend] Graceful shutdown completed.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => void handleShutdown("SIGTERM"));
process.on("SIGINT", () => void handleShutdown("SIGINT"));
