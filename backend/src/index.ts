import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createBackendServer } from "./server.js";

const envPath = fs.existsSync(".env.local")
  ? path.resolve(".env.local")
  : path.resolve("..", ".env.local");

dotenv.config({ path: envPath });

import { getBackendEnv } from "./config/env.js";

const env = getBackendEnv();
const port = env.PORT || env.BACKEND_PORT;
const host = env.HOST;

const server = createBackendServer();

server.listen(port, host, () => {
  console.log(`\n========================================`);
  console.log(`  AI Starter Backend API Server`);
  console.log(`  Listening at:     http://localhost:${port}`);
  console.log(`  API Docs:         http://localhost:${port}/docs`);
  console.log(`  OpenAPI Spec:     http://localhost:${port}/openapi.json`);
  console.log(`  Liveness Probe:   http://localhost:${port}/healthz`);
  console.log(`  Readiness Probe:  http://localhost:${port}/readyz`);
  if (env.MOCK_AI) {
    console.log(`  Mode:             OFFLINE MOCK AI (MOCK_AI=true)`);
  }
  console.log(`========================================\n`);
});

process.on("SIGTERM", () => {
  console.log("Shutting down backend server...");
  server.close();
});

