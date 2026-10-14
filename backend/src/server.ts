import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { guardAuth, guardRoles } from "./middleware/rbac.js";
import { applyRateLimit, aiRateLimiter, apiRateLimiter } from "./middleware/rate-limit.js";
import { validateAiTestRequest } from "./lib/ai-test-request.js";
import {
  isArchestraConfigured,
  isMockAiEnabled,
  runConnectionTest,
} from "./mastra/agents/connection-test-agent.js";
import { getLivenessReport, getReadinessReport } from "./lib/health.js";
import { openapiSpec, renderDocsHtml } from "./docs/openapi.js";
import { logger, generateRequestId, type Logger } from "./lib/logger.js";

function setCorsHeaders(res: ServerResponse, origin?: string): void {
  const allowedOrigin =
    origin && (origin.includes("localhost:3001") || origin.includes("127.0.0.1:3001"))
      ? origin
      : "http://localhost:3001";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-user-roles, x-request-id",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function createBackendServer(): http.Server {
  return http.createServer(async (req, res) => {
    const startTime = performance.now();
    const origin = req.headers.origin;
    setCorsHeaders(res, origin);

    // 1. Correlation ID
    const incomingReqId = req.headers["x-request-id"];
    const reqId =
      typeof incomingReqId === "string" && incomingReqId.trim().length > 0
        ? incomingReqId
        : generateRequestId();

    res.setHeader("x-request-id", reqId);

    const parsedUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = parsedUrl.pathname;
    const reqLogger: Logger = logger.child({ reqId, method: req.method, path: pathname });

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Log response completion with appropriate severity for observability
    res.on("finish", () => {
      const durationMs = Math.round(performance.now() - startTime);
      const logData = {
        statusCode: res.statusCode,
        durationMs,
      };
      if (res.statusCode >= 500) {
        reqLogger.error(`${req.method} ${pathname} ${res.statusCode}`, logData);
      } else if (res.statusCode >= 400) {
        reqLogger.warn(`${req.method} ${pathname} ${res.statusCode}`, logData);
      } else {
        reqLogger.info(`${req.method} ${pathname} ${res.statusCode}`, logData);
      }
    });

    // 2. Health & Readiness Probes (bypass general rate limits)
    if (req.method === "GET" && (pathname === "/healthz" || pathname === "/health" || pathname === "/api/health")) {
      sendJson(res, 200, getLivenessReport());
      return;
    }

    if (req.method === "GET" && pathname === "/readyz") {
      const { statusCode, report } = await getReadinessReport();
      sendJson(res, statusCode, report);
      return;
    }

    // 3. API Documentation & OpenAPI Spec
    if (req.method === "GET" && pathname === "/openapi.json") {
      sendJson(res, 200, openapiSpec);
      return;
    }

    if (req.method === "GET" && (pathname === "/docs" || pathname === "/swagger")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderDocsHtml());
      return;
    }

    // 4. General API Rate Limiting
    if (!applyRateLimit(req, res, apiRateLimiter)) {
      reqLogger.warn("Rate limit exceeded on general API", { path: pathname });
      return;
    }

    // 5. Admin Status Endpoint
    if (req.method === "GET" && pathname === "/api/admin/status") {
      const user = await guardAuth(req, res);
      if (!user) return;

      if (!guardRoles(res, user, ["admin"])) return;

      sendJson(res, 200, {
        authenticated: true,
        authorized: true,
        capabilities: ["admin:access"],
      });
      return;
    }

    // 6. AI Test Endpoint
    if (req.method === "POST" && pathname === "/api/ai/test") {
      // Stricter rate limit for AI operations
      if (!applyRateLimit(req, res, aiRateLimiter)) {
        reqLogger.warn("Rate limit exceeded on AI endpoint", { path: pathname });
        return;
      }

      const user = await guardAuth(req, res);
      if (!user) return;

      if (!guardRoles(res, user, ["developer", "admin"])) return;

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { error: "Request body must be valid JSON." });
        return;
      }

      const validation = validateAiTestRequest(body);
      if (!validation.success) {
        sendJson(res, validation.status, { error: validation.error });
        return;
      }

      if (!isMockAiEnabled() && !isArchestraConfigured()) {
        const errorMsg =
          "Archestra gateway is not fully configured in .env.local (ARCHESTRA_VIRTUAL_KEY, ARCHESTRA_BASE_URL, or ARCHESTRA_MODEL is missing). Set MOCK_AI=true to test offline.";
        reqLogger.error("Archestra gateway configuration missing or incomplete", {
          error: errorMsg,
          hasVirtualKey: Boolean(process.env.ARCHESTRA_VIRTUAL_KEY?.trim()),
          hasBaseUrl: Boolean(process.env.ARCHESTRA_BASE_URL?.trim()),
          hasModel: Boolean(process.env.ARCHESTRA_MODEL?.trim()),
        });
        sendJson(res, 500, {
          error: errorMsg,
        });
        return;
      }

      try {
        const result = await runConnectionTest(validation.prompt);
        reqLogger.info("AI connection test completed successfully", {
          mocked: result.mocked,
        });
        sendJson(res, 200, { result: result.text, mocked: result.mocked });
      } catch (error) {
        reqLogger.error("AI connection test failed.", {
          err: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        sendJson(res, 502, {
          error: "AI request failed. Check backend server logs for details.",
        });
      }
      return;
    }

    // Default 404
    sendJson(res, 404, { error: `Not found: ${req.method} ${pathname}` });
  });
}
