import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { guardAuth, guardRoles } from "./middleware/rbac.js";
import { applyRateLimit, aiRateLimiter, apiRateLimiter } from "./middleware/rate-limit.js";
import { validateAiTestRequest } from "./lib/ai-test-request.js";
import {
  isArchestraConfigured,
  runConnectionTest,
} from "./mastra/agents/connection-test-agent.js";
import { getBackendEnv } from "./config/env.js";
import { getLivenessReport, getReadinessReport } from "./lib/health.js";
import { openapiSpec, renderDocsHtml } from "./docs/openapi.js";
import { logger, generateRequestId, type Logger } from "./lib/logger.js";
import {
  createConversation,
  listUserConversations,
  getConversationById,
  getConversationMessages,
  addConversationMessage,
  deleteConversation,
  getDatabaseStats,
  clearAllConversations,
} from "./db/repository.js";

function getAllowedOrigins(): string[] {
  const env = getBackendEnv();
  const configured = [
    env.FRONTEND_URL,
    env.CORS_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()),
  ]
    .flat()
    .filter((v): v is string => Boolean(v && v.trim().length > 0));

  return Array.from(new Set(configured));
}

function setCorsHeaders(res: ServerResponse, origin?: string): void {
  const allowed = getAllowedOrigins();
  let selectedOrigin = allowed[0] || "";

  if (origin) {
    if (allowed.includes(origin) || allowed.includes("*")) {
      selectedOrigin = origin;
    } else {
      try {
        const reqOrigin = new URL(origin).origin;
        const matched = allowed.find((allowedItem) => {
          try {
            return new URL(allowedItem).origin === reqOrigin;
          } catch {
            return false;
          }
        });
        if (matched) {
          selectedOrigin = origin;
        }
      } catch {
        // Fall back to primary origin
      }
    }
  }

  if (selectedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", selectedOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-user-roles, x-user-id, x-user-email, x-request-id",
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

    const pathname = (req.url ?? "/").split("?")[0] || "/";
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

    // 5. Admin Status & Management Endpoints
    if (req.method === "GET" && pathname === "/api/admin/status") {
      const user = await guardAuth(req, res);
      if (!user) return;

      if (!guardRoles(res, user, ["admin"])) return;

      const { report: readiness } = await getReadinessReport();
      const liveness = getLivenessReport();

      let dbStats = { status: "healthy", totalConversations: 0, totalMessages: 0 };
      try {
        dbStats = await getDatabaseStats();
      } catch (dbErr) {
        reqLogger.warn("Admin status could not fetch db metrics", {
          err: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
        dbStats.status = "unavailable";
      }

      sendJson(res, 200, {
        authenticated: true,
        authorized: true,
        capabilities: [
          "admin:access",
          "system:diagnostics",
          "database:manage",
          "observability:view",
        ],
        adminUser: {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles,
        },
        system: {
          service: liveness.service,
          uptimeSeconds: liveness.uptimeSeconds,
          node: liveness.node,
          memory: liveness.memory,
        },
        dependencies: readiness.checks,
        database: dbStats,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/admin/conversations/clear") {
      const user = await guardAuth(req, res);
      if (!user) return;

      if (!guardRoles(res, user, ["admin"])) return;

      try {
        await clearAllConversations();
        reqLogger.info("Admin cleared all conversations and messages");
        sendJson(res, 200, { success: true, message: "All platform conversations cleared." });
      } catch (err) {
        reqLogger.error("Failed to clear platform conversations", {
          err: err instanceof Error ? err.message : String(err),
        });
        sendJson(res, 500, { error: "Failed to clear platform conversations." });
      }
      return;
    }

    // 6. Conversations Endpoints
    if (req.method === "GET" && pathname === "/api/conversations") {
      const user = await guardAuth(req, res);
      if (!user) return;

      const userId = user.id || user.email || "unknown";
      try {
        const list = await listUserConversations(userId);
        sendJson(res, 200, { conversations: list });
      } catch (error) {
        reqLogger.error("Failed to list conversations", {
          err: error instanceof Error ? error.message : String(error),
        });
        sendJson(res, 500, { error: "Failed to list conversations." });
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/conversations") {
      const user = await guardAuth(req, res);
      if (!user) return;

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { error: "Request body must be valid JSON." });
        return;
      }

      const titleRaw =
        typeof body === "object" && body !== null && "title" in body && typeof body.title === "string"
          ? body.title.trim()
          : "New Conversation";
      const title = titleRaw.slice(0, 255) || "New Conversation";
      const userId = user.id || user.email || "unknown";

      try {
        const conversation = await createConversation(userId, title);
        sendJson(res, 201, { conversation });
      } catch (error) {
        reqLogger.error("Failed to create conversation", {
          err: error instanceof Error ? error.message : String(error),
        });
        sendJson(res, 500, { error: "Failed to create conversation." });
      }
      return;
    }

    const conversationMessagesMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
    if (req.method === "GET" && conversationMessagesMatch) {
      const user = await guardAuth(req, res);
      if (!user) return;

      const conversationId = conversationMessagesMatch[1];
      const userId = user.id || user.email || "unknown";

      try {
        const conv = await getConversationById(conversationId, userId);
        if (!conv) {
          sendJson(res, 404, { error: "Conversation not found." });
          return;
        }
        const msgs = await getConversationMessages(conversationId);
        sendJson(res, 200, { messages: msgs });
      } catch (error) {
        reqLogger.error("Failed to fetch conversation messages", {
          err: error instanceof Error ? error.message : String(error),
        });
        sendJson(res, 500, { error: "Failed to fetch messages." });
      }
      return;
    }

    const conversationDetailMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (conversationDetailMatch) {
      const conversationId = conversationDetailMatch[1];

      if (req.method === "GET") {
        const user = await guardAuth(req, res);
        if (!user) return;

        const userId = user.id || user.email || "unknown";
        try {
          const conv = await getConversationById(conversationId, userId);
          if (!conv) {
            sendJson(res, 404, { error: "Conversation not found." });
            return;
          }
          sendJson(res, 200, { conversation: conv });
        } catch (error) {
          reqLogger.error("Failed to fetch conversation", {
            err: error instanceof Error ? error.message : String(error),
          });
          sendJson(res, 500, { error: "Failed to fetch conversation." });
        }
        return;
      }

      if (req.method === "DELETE") {
        const user = await guardAuth(req, res);
        if (!user) return;

        const userId = user.id || user.email || "unknown";
        try {
          const deleted = await deleteConversation(conversationId, userId);
          if (!deleted) {
            sendJson(res, 404, { error: "Conversation not found." });
            return;
          }
          sendJson(res, 200, { success: true });
        } catch (error) {
          reqLogger.error("Failed to delete conversation", {
            err: error instanceof Error ? error.message : String(error),
          });
          sendJson(res, 500, { error: "Failed to delete conversation." });
        }
        return;
      }
    }

    // 7. AI Test Endpoint
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

      if (validation.conversationId) {
        const userId = user.id || user.email || "unknown";
        try {
          const conv = await getConversationById(validation.conversationId, userId);
          if (!conv) {
            sendJson(res, 404, { error: "Conversation not found." });
            return;
          }
          await addConversationMessage(validation.conversationId, "user", validation.prompt);
        } catch (error) {
          reqLogger.error("Failed to check conversation or persist user message", {
            err: error instanceof Error ? error.message : String(error),
          });
          sendJson(res, 500, { error: "Failed to persist conversation message." });
          return;
        }
      }

      if (!isArchestraConfigured()) {
        const errorMsg =
          "Archestra gateway is not fully configured (ARCHESTRA_VIRTUAL_KEY, ARCHESTRA_BASE_URL, or ARCHESTRA_MODEL missing).";
        reqLogger.error("Archestra gateway configuration missing or incomplete", {
          error: errorMsg,
        });
        sendJson(res, 500, {
          error: errorMsg,
        });
        return;
      }

      try {
        const result = await runConnectionTest(validation.prompt);
        reqLogger.info("AI connection test completed successfully");

        if (validation.conversationId) {
          try {
            await addConversationMessage(validation.conversationId, "assistant", result.text);
          } catch (persistErr) {
            reqLogger.warn("AI completed but failed to persist assistant message", {
              err: persistErr instanceof Error ? persistErr.message : String(persistErr),
            });
          }
        }

        sendJson(res, 200, {
          result: result.text,
          ...(validation.conversationId ? { conversationId: validation.conversationId } : {}),
        });
      } catch (error) {
        reqLogger.error("AI connection test failed.", {
          err: error instanceof Error ? error.message : String(error),
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
