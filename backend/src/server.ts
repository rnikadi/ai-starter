import http, { type IncomingMessage, type ServerResponse } from "node:http";
import helmet from "helmet";
import { guardAuth, guardRoles } from "./middleware/rbac.js";
import { applyRateLimit, aiRateLimiter, apiRateLimiter } from "./middleware/rate-limit.js";
import { validateAiTestRequest, createConversationSchema } from "./lib/ai-test-request.js";
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
  updateConversationTitle,
  getDatabaseStats,
  clearAllConversations,
  createDocument,
  listDocuments,
  getDocumentById,
  deleteDocument,
  searchSimilarDocuments,
} from "./db/repository.js";
import {
  getPrometheusMetrics,
  getMetricsContentType,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  aiRequestsTotal,
  aiRequestDurationSeconds,
  recordAiTokenUsage,
} from "./lib/metrics.js";
import {
  sendError,
  HttpError,
  BadRequestError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
} from "./lib/errors.js";
import {
  generateEmbedding,
  buildRagPrompt,
  type RetrievedDocument,
} from "./lib/rag.js";
import {
  getTracer,
  extractTraceContext,
  injectTraceContext,
  traceAsync,
  trace,
  context,
  SpanKind,
  SpanStatusCode,
} from "./lib/tracing.js";

const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

export { PayloadTooLargeError };

const MAX_JSON_BODY_BYTES = 1024 * 1024; // 1 MB

function normalizeRouteLabel(pathname: string): string {
  if (pathname.startsWith("/api/conversations/")) {
    const parts = pathname.split("/");
    if (parts.length === 5 && parts[4] === "messages") {
      return "/api/conversations/:id/messages";
    }
    if (parts.length === 4) {
      return "/api/conversations/:id";
    }
  }
  if (pathname.startsWith("/api/documents/")) {
    return "/api/documents/:id";
  }
  if (
    pathname === "/api/conversations" ||
    pathname === "/api/documents" ||
    pathname === "/api/rag/search" ||
    pathname === "/api/ai/test" ||
    pathname === "/api/admin/status" ||
    pathname === "/api/admin/conversations/clear" ||
    pathname === "/healthz" ||
    pathname === "/health" ||
    pathname === "/readyz" ||
    pathname === "/openapi.json" ||
    pathname === "/docs" ||
    pathname === "/swagger" ||
    pathname === "/metrics"
  ) {
    return pathname;
  }
  return "other";
}

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
    "Content-Type, Authorization, x-user-roles, x-user-id, x-user-email, x-request-id, traceparent, tracestate, x-trace-id",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "x-request-id, x-trace-id, traceparent",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readJsonBody(
  req: IncomingMessage,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    let receivedBytes = 0;

    req.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        req.destroy();
        reject(new PayloadTooLargeError());
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new BadRequestError("Request body must be valid JSON.", "INVALID_JSON"));
      }
    });

    req.on("error", reject);
  });
}

export function createBackendServer(): http.Server {
  return http.createServer(async (req, res) => {
    const startTime = performance.now();

    // 0. Distributed Tracing: Extract W3C Context and start HTTP server span
    const incomingCtx = extractTraceContext(req.headers);
    const tracer = getTracer();
    const pathname = (req.url ?? "/").split("?")[0] || "/";
    const route = normalizeRouteLabel(pathname);

    const serverSpan = tracer.startSpan(
      `${req.method || "HTTP"} ${route}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          "http.method": req.method || "UNKNOWN",
          "http.target": pathname,
          "http.route": route,
        },
      },
      incomingCtx,
    );

    const reqCtx = trace.setSpan(incomingCtx, serverSpan);

    return context.with(reqCtx, async () => {
      const spanContext = serverSpan.spanContext();
      const traceId = spanContext.traceId;

      // Apply OWASP Security Headers via Helmet
      if (typeof res.setHeader === "function") {
        if (typeof res.removeHeader !== "function") {
          (res as unknown as { removeHeader: (name: string) => void }).removeHeader = () => {
            // Fallback if not implemented on mock
          };
        }
        await new Promise<void>((resolve) => helmetMiddleware(req, res, () => resolve()));
      }

      const origin = req.headers.origin;
      setCorsHeaders(res, origin);

      // 1. Correlation ID
      const incomingReqId = req.headers["x-request-id"];
      const reqId =
        typeof incomingReqId === "string" && incomingReqId.trim().length > 0
          ? incomingReqId
          : generateRequestId();

      res.setHeader("x-request-id", reqId);
      if (traceId) {
        res.setHeader("x-trace-id", traceId);
        const traceHeaders: Record<string, string> = {};
        injectTraceContext(traceHeaders, reqCtx);
        if (traceHeaders.traceparent) {
          res.setHeader("traceparent", traceHeaders.traceparent);
        }
      }

      serverSpan.setAttribute("http.request_id", reqId);

      const reqLogger: Logger = logger.child({ reqId, traceId, method: req.method, path: pathname });

      // Handle preflight
      if (req.method === "OPTIONS") {
        serverSpan.setStatus({ code: SpanStatusCode.OK });
        serverSpan.end();
        res.writeHead(204);
        res.end();
        return;
      }

      // Log response completion with appropriate severity and record Prometheus metrics & OTel span
      res.on("finish", () => {
        const durationSeconds = (performance.now() - startTime) / 1000;
        const durationMs = Math.round(durationSeconds * 1000);
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

        try {
          serverSpan.setAttribute("http.status_code", res.statusCode);
          if (res.statusCode >= 500) {
            serverSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${res.statusCode}`,
            });
          } else {
            serverSpan.setStatus({ code: SpanStatusCode.OK });
          }
          serverSpan.end();
        } catch {
          // Ignore span finish errors
        }

        try {
          const route = normalizeRouteLabel(pathname);
          const method = req.method || "UNKNOWN";
          const statusCode = res.statusCode.toString();
          httpRequestsTotal.inc({ method, route, status_code: statusCode });
          httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);
        } catch {
          // Suppress any metrics recording error to protect request lifecycle
        }
      });

    // 2. Health, Readiness & Metrics Probes (bypass general rate limits)
    if (req.method === "GET" && (pathname === "/healthz" || pathname === "/health" || pathname === "/api/health")) {
      sendJson(res, 200, getLivenessReport());
      return;
    }

    if (req.method === "GET" && pathname === "/readyz") {
      const { statusCode, report } = await getReadinessReport();
      sendJson(res, statusCode, report);
      return;
    }

    if (req.method === "GET" && pathname === "/metrics") {
      try {
        const metrics = await getPrometheusMetrics();
        res.writeHead(200, { "Content-Type": getMetricsContentType() });
        res.end(metrics);
      } catch (err) {
        reqLogger.error("Failed to export Prometheus metrics", {
          err: err instanceof Error ? err.message : String(err),
        });
        sendJson(res, 500, { error: "Failed to export metrics" });
      }
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
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          sendJson(res, 413, { error: err.message });
          return;
        }
        sendJson(res, 400, { error: "Request body must be valid JSON." });
        return;
      }

      let title = "New Conversation";
      if (typeof body === "object" && body !== null && "title" in body) {
        const parsed = createConversationSchema.safeParse(body);
        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.issues[0]?.message ?? "Invalid title." });
          return;
        }
        title = parsed.data.title;
      }

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

      if (req.method === "PATCH") {
        const user = await guardAuth(req, res);
        if (!user) return;

        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          if (err instanceof PayloadTooLargeError) {
            sendJson(res, 413, { error: err.message });
            return;
          }
          sendJson(res, 400, { error: "Request body must be valid JSON." });
          return;
        }

        const parsed = createConversationSchema.safeParse(body);
        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.issues[0]?.message ?? "Invalid title." });
          return;
        }

        const userId = user.id || user.email || "unknown";
        try {
          const updated = await updateConversationTitle(conversationId, userId, parsed.data.title);
          if (!updated) {
            sendJson(res, 404, { error: "Conversation not found." });
            return;
          }
          sendJson(res, 200, { conversation: updated });
        } catch (error) {
          reqLogger.error("Failed to update conversation title", {
            err: error instanceof Error ? error.message : String(error),
          });
          sendJson(res, 500, { error: "Failed to update conversation." });
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

    // 7. Knowledge Base & Vector Search Endpoints
    if (req.method === "GET" && pathname === "/api/documents") {
      const user = await guardAuth(req, res);
      if (!user) return;

      try {
        const docs = await listDocuments(50);
        sendJson(res, 200, { documents: docs });
      } catch (err) {
        sendError(res, err, traceId);
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/documents") {
      const user = await guardAuth(req, res);
      if (!user) return;

      if (!guardRoles(res, user, ["developer", "admin"])) return;

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        sendError(res, err, traceId);
        return;
      }

      const raw = body as Record<string, unknown>;
      const title = typeof raw?.title === "string" ? raw.title.trim() : "";
      const content = typeof raw?.content === "string" ? raw.content.trim() : "";
      const metadata =
        typeof raw?.metadata === "string"
          ? raw.metadata
          : raw?.metadata !== undefined
          ? JSON.stringify(raw.metadata)
          : undefined;

      if (!title || !content) {
        sendError(
          res,
          new BadRequestError("Both 'title' and 'content' are required non-empty strings."),
          traceId,
        );
        return;
      }

      try {
        const embedding = await generateEmbedding(content);
        const doc = await createDocument({ title, content, metadata, embedding });
        sendJson(res, 201, { document: doc });
      } catch (err) {
        sendError(res, err, traceId);
      }
      return;
    }

    const documentDetailMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
    if (documentDetailMatch) {
      const docId = documentDetailMatch[1];

      if (req.method === "GET") {
        const user = await guardAuth(req, res);
        if (!user) return;

        try {
          const doc = await getDocumentById(docId);
          if (!doc) {
            sendError(res, new NotFoundError("Document not found."), traceId);
            return;
          }
          sendJson(res, 200, { document: doc });
        } catch (err) {
          sendError(res, err, traceId);
        }
        return;
      }

      if (req.method === "DELETE") {
        const user = await guardAuth(req, res);
        if (!user) return;

        if (!guardRoles(res, user, ["developer", "admin"])) return;

        try {
          const deleted = await deleteDocument(docId);
          if (!deleted) {
            sendError(res, new NotFoundError("Document not found."), traceId);
            return;
          }
          sendJson(res, 200, { success: true });
        } catch (err) {
          sendError(res, err, traceId);
        }
        return;
      }
    }

    if (req.method === "POST" && pathname === "/api/rag/search") {
      const user = await guardAuth(req, res);
      if (!user) return;

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        sendError(res, err, traceId);
        return;
      }

      const raw = body as Record<string, unknown>;
      const query = typeof raw?.query === "string" ? raw.query.trim() : "";
      const limit = typeof raw?.limit === "number" && raw.limit > 0 ? Math.min(raw.limit, 20) : 5;
      const threshold = typeof raw?.threshold === "number" ? raw.threshold : 0.0;

      if (!query) {
        sendError(res, new BadRequestError("The 'query' field must be a non-empty string."), traceId);
        return;
      }

      try {
        const queryEmbedding = await generateEmbedding(query);
        const results = await searchSimilarDocuments(queryEmbedding, limit, threshold);
        sendJson(res, 200, { results });
      } catch (err) {
        sendError(res, err, traceId);
      }
      return;
    }

    // 8. AI Test Endpoint
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
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          sendError(res, err, traceId);
          return;
        }
        sendError(res, new BadRequestError("Request body must be valid JSON."), traceId);
        return;
      }

      const validation = validateAiTestRequest(body);
      if (!validation.success) {
        sendError(
          res,
          validation.status === 413
            ? new PayloadTooLargeError(validation.error)
            : new BadRequestError(validation.error),
          traceId,
        );
        return;
      }

      if (validation.conversationId) {
        const userId = user.id || user.email || "unknown";
        try {
          const conv = await getConversationById(validation.conversationId, userId);
          if (!conv) {
            sendError(res, new NotFoundError("Conversation not found."), traceId);
            return;
          }
          await addConversationMessage(validation.conversationId, "user", validation.prompt);
        } catch (error) {
          reqLogger.error("Failed to check conversation or persist user message", {
            err: error instanceof Error ? error.message : String(error),
          });
          sendError(res, new HttpError(500, "Failed to persist conversation message."), traceId);
          return;
        }
      }

      if (!isArchestraConfigured()) {
        const errorMsg =
          "Archestra gateway is not fully configured (ARCHESTRA_VIRTUAL_KEY, ARCHESTRA_BASE_URL, or ARCHESTRA_MODEL missing).";
        reqLogger.error("Archestra gateway configuration missing or incomplete", {
          error: errorMsg,
        });
        sendError(res, new HttpError(500, errorMsg, "CONFIG_ERROR"), traceId);
        return;
      }

      const aiStartTime = performance.now();
      const model = getBackendEnv().ARCHESTRA_MODEL || "unknown";

      // Active RAG context injection
      let effectivePrompt = validation.prompt;
      let ragContext: RetrievedDocument[] = [];

      if (validation.rag) {
        try {
          const queryEmbedding = await generateEmbedding(validation.prompt);
          ragContext = await searchSimilarDocuments(queryEmbedding, 3, 0.2);
          if (ragContext.length > 0) {
            effectivePrompt = buildRagPrompt(validation.prompt, ragContext);
          }
        } catch (ragErr) {
          reqLogger.warn("RAG retrieval failed, proceeding with original prompt", {
            err: ragErr instanceof Error ? ragErr.message : String(ragErr),
          });
        }
      }

      try {
        const result = await traceAsync("ai.archestra_gateway", async (span) => {
          span.setAttribute("ai.provider", "archestra");
          span.setAttribute("ai.model", model);
          span.setAttribute("ai.prompt.length", effectivePrompt.length);
          if (ragContext.length > 0) {
            span.setAttribute("ai.rag.chunks_retrieved", ragContext.length);
          }
          if (validation.conversationId) {
            span.setAttribute("conversation.id", validation.conversationId);
          }
          return runConnectionTest(effectivePrompt);
        });

        const aiDurationSeconds = (performance.now() - aiStartTime) / 1000;
        try {
          aiRequestsTotal.inc({ status: "success", model });
          aiRequestDurationSeconds.observe({ status: "success", model }, aiDurationSeconds);
        } catch {
          // Ignore metrics collection errors
        }

        // Prometheus LLM Token & Cost Tracking
        const promptTokens =
          result.usage?.promptTokens ?? Math.ceil(effectivePrompt.length / 4);
        const completionTokens =
          result.usage?.completionTokens ?? Math.ceil(result.text.length / 4);

        try {
          recordAiTokenUsage(model, promptTokens, completionTokens);
        } catch {
          // Suppress metrics error
        }

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
          ...(ragContext.length > 0 ? { ragContext } : {}),
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        });
      } catch (error) {
        const aiDurationSeconds = (performance.now() - aiStartTime) / 1000;
        try {
          aiRequestsTotal.inc({ status: "error", model });
          aiRequestDurationSeconds.observe({ status: "error", model }, aiDurationSeconds);
        } catch {
          // Ignore metrics collection errors
        }

        reqLogger.error("AI connection test failed.", {
          err: error instanceof Error ? error.message : String(error),
        });
        sendError(
          res,
          new HttpError(502, "AI request failed. Check backend server logs for details.", "AI_GATEWAY_ERROR"),
          traceId,
        );
      }
      return;
    }

    // Default 404
    sendError(res, new NotFoundError(`Not found: ${req.method} ${pathname}`), traceId);
    });

  });
}
