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
  console.log(`========================================\n`);
});

process.on("SIGTERM", () => {
  console.log("Shutting down backend server...");
  server.close();
});
