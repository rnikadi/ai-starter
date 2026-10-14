import { describe, it, expect, beforeAll, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createBackendServer } from "./server.js";
import { Readable } from "node:stream";

vi.mock("./mastra/agents/connection-test-agent.js", () => ({
  isArchestraConfigured: () => true,
  runConnectionTest: async (prompt: string) => ({
    text: `Connection test successful for: ${prompt}`,
  }),
}));

vi.mock("./db/repository.js", () => ({
  createConversation: vi.fn(async (userId: string, title: string) => ({
    id: "conv-mock-123",
    userId,
    title,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  listUserConversations: vi.fn(async (userId: string) => [
    {
      id: "conv-mock-123",
      userId,
      title: "Test Conversation",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getConversationById: vi.fn(async (conversationId: string, userId: string) => {
    if (conversationId === "conv-mock-123") {
      return {
        id: conversationId,
        userId,
        title: "Test Conversation",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }),
  getConversationMessages: vi.fn(async (conversationId: string) => [
    {
      id: "msg-1",
      conversationId,
      role: "user",
      content: "Hello",
      createdAt: new Date(),
    },
  ]),
  addConversationMessage: vi.fn(async (conversationId: string, role: string, content: string) => ({
    id: "msg-mock-456",
    conversationId,
    role,
    content,
    createdAt: new Date(),
  })),
  deleteConversation: vi.fn(async (conversationId: string) => {
    return conversationId === "conv-mock-123";
  }),
  updateConversationTitle: vi.fn(async (conversationId: string, userId: string, title: string) => {
    if (conversationId === "conv-mock-123") {
      return { id: conversationId, userId, title, updatedAt: new Date() };
    }
    return null;
  }),
  getDatabaseStats: vi.fn(async () => ({
    status: "healthy",
    totalConversations: 5,
    totalMessages: 12,
  })),
  clearAllConversations: vi.fn(async () => ({
    success: true,
  })),
}));

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function executeRequest(
  server: ReturnType<typeof createBackendServer>,
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
  },
): Promise<MockResponse> {
  return new Promise((resolve) => {
    let pushed = false;
    const req = new Readable({
      read() {
        if (!pushed) {
          pushed = true;
          if (options.body !== undefined && options.body !== null) {
            const payload =
              typeof options.body === "string"
                ? options.body
                : JSON.stringify(options.body);
            this.push(Buffer.from(payload));
          }
          this.push(null);
        }
      },
    }) as unknown as IncomingMessage;

    req.method = options.method || "GET";
    req.url = options.url || "/";
    req.headers = { host: "localhost:4000", ...options.headers };
    (req as unknown as { socket: { remoteAddress: string } }).socket = {
      remoteAddress: "127.0.0.1",
    };

    const resHeaders: Record<string, string> = {};
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      body: "",
      setHeader(name: string, value: string) {
        resHeaders[name.toLowerCase()] = value;
        return res;
      },
      removeHeader(name: string) {
        delete resHeaders[name.toLowerCase()];
        return res;
      },
      getHeader(name: string) {
        return resHeaders[name.toLowerCase()];
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writeHead(status: number, ...args: any[]) {
        res.statusCode = status;
        const headers = args.find((a) => typeof a === "object" && a !== null);
        if (headers) {
          for (const [k, v] of Object.entries(headers)) {
            resHeaders[k.toLowerCase()] = String(v);
          }
        }
        return res;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      end(chunk?: any, ..._rest: any[]) {
        if (chunk && typeof chunk !== "function") {
          res.body += chunk.toString();
        }
        res.emit("finish");
        resolve({
          statusCode: res.statusCode,
          headers: resHeaders,
          body: res.body,
        });
        return res;
      },
    }) as unknown as ServerResponse & { body: string; statusCode: number };

    const listeners = server.listeners("request") as ((
      req: IncomingMessage,
      res: ServerResponse,
    ) => void)[];
    const handler = listeners[0];
    handler(req, res);

    if (options.body !== undefined && options.body !== null) {
      const payload =
        typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      req.emit("data", Buffer.from(payload));
    }
    req.emit("end");
  });
}

describe("Backend Server Endpoints", () => {
  beforeAll(() => {
    process.env.AUTH_KEYCLOAK_ISSUER = "http://localhost:8080/realms/ai-starter";
    process.env.ARCHESTRA_BASE_URL = "http://localhost:9000/v1/openrouter";
    process.env.ARCHESTRA_VIRTUAL_KEY = "test-virtual-key";
    process.env.ARCHESTRA_MODEL = "test-model";
    process.env.FRONTEND_URL = "http://localhost:3001";
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ||
      "postgresql://aistarter:aistarter_local_secret@localhost:5432/aistarter_test_db";
  });

  const server = createBackendServer();

  it("serves liveness probe on /healthz", async () => {
    const res = await executeRequest(server, { url: "/healthz" });
    expect(res.statusCode).toBe(200);

    const json = JSON.parse(res.body) as Record<string, unknown>;
    expect(json.status).toBe("healthy");
    expect(json.service).toBe("ai-starter-backend");
    expect(json.uptimeSeconds).toBeDefined();
    expect(json.memory).toBeDefined();
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("serves backwards-compatible /health", async () => {
    const res = await executeRequest(server, { url: "/health" });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as Record<string, unknown>;
    expect(json.status).toBe("healthy");
  });

  it("serves OpenAPI 3.1 specification on /openapi.json", async () => {
    const res = await executeRequest(server, { url: "/openapi.json" });
    expect(res.statusCode).toBe(200);

    const json = JSON.parse(res.body) as Record<string, unknown>;
    expect(json.openapi).toBe("3.1.0");
    expect(json.info).toBeDefined();
    expect(json.paths).toBeDefined();
  });

  it("serves interactive HTML docs on /docs", async () => {
    const res = await executeRequest(server, { url: "/docs" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("AI Starter Backend API");
    expect(res.body).toContain("/healthz");
    expect(res.body).toContain("/api/ai/test");
  });

  it("rejects unauthorized request to /api/admin/status with 401", async () => {
    const res = await executeRequest(server, { url: "/api/admin/status" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-admin role on /api/admin/status with 403", async () => {
    const res = await executeRequest(server, {
      url: "/api/admin/status",
      headers: {
        "x-user-roles": JSON.stringify(["viewer", "developer"]),
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows admin role on /api/admin/status with 200", async () => {
    const res = await executeRequest(server, {
      url: "/api/admin/status",
      headers: {
        "x-user-roles": JSON.stringify(["admin"]),
      },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as Record<string, unknown>;
    expect(json.authenticated).toBe(true);
    expect(json.authorized).toBe(true);
    expect(json.system).toBeDefined();
    expect(json.database).toBeDefined();
  });

  it("allows admin to clear conversations on POST /api/admin/conversations/clear", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/admin/conversations/clear",
      headers: {
        "x-user-roles": JSON.stringify(["admin"]),
      },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("rejects non-admin role on POST /api/admin/conversations/clear with 403", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/admin/conversations/clear",
      headers: {
        "x-user-roles": JSON.stringify(["developer"]),
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects unauthorized request to /api/ai/test with 401", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/ai/test",
      headers: { "content-type": "application/json" },
      body: { prompt: "Hello" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects viewer role on /api/ai/test with 403", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/ai/test",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["viewer"]),
      },
      body: { prompt: "Hello" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("executes AI test in /api/ai/test with developer role", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/ai/test",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["developer"]),
      },
      body: { prompt: "Echo test" },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as Record<string, unknown>;
    expect(json.mocked).toBeUndefined();
    expect(json.result).toContain("Connection test successful for: Echo test");
  });

  it("rejects unauthorized request to /api/conversations with 401", async () => {
    const res = await executeRequest(server, { url: "/api/conversations" });
    expect(res.statusCode).toBe(401);
  });

  it("lists conversations for authenticated user on GET /api/conversations", async () => {
    const res = await executeRequest(server, {
      url: "/api/conversations",
      headers: {
        "x-user-roles": JSON.stringify(["viewer"]),
      },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as { conversations: unknown[] };
    expect(Array.isArray(json.conversations)).toBe(true);
    expect(json.conversations.length).toBe(1);
  });

  it("creates a conversation on POST /api/conversations", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/conversations",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["developer"]),
      },
      body: { title: "New Chat" },
    });
    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body) as { conversation: { title: string } };
    expect(json.conversation.title).toBe("New Chat");
  });

  it("fetches conversation messages on GET /api/conversations/:id/messages", async () => {
    const res = await executeRequest(server, {
      url: "/api/conversations/conv-mock-123/messages",
      headers: {
        "x-user-roles": JSON.stringify(["developer"]),
      },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as { messages: unknown[] };
    expect(Array.isArray(json.messages)).toBe(true);
  });

  it("returns 404 for non-existent conversation messages", async () => {
    const res = await executeRequest(server, {
      url: "/api/conversations/non-existent-id/messages",
      headers: {
        "x-user-roles": JSON.stringify(["developer"]),
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("deletes a conversation on DELETE /api/conversations/:id", async () => {
    const res = await executeRequest(server, {
      method: "DELETE",
      url: "/api/conversations/conv-mock-123",
      headers: {
        "x-user-roles": JSON.stringify(["developer"]),
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 when deleting non-existent conversation", async () => {
    const res = await executeRequest(server, {
      method: "DELETE",
      url: "/api/conversations/non-existent-id",
      headers: {
        "x-user-roles": JSON.stringify(["developer"]),
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("renames a conversation on PATCH /api/conversations/:id", async () => {
    const res = await executeRequest(server, {
      method: "PATCH",
      url: "/api/conversations/conv-mock-123",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["developer"]),
      },
      body: { title: "Renamed Chat" },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as { conversation: { title: string } };
    expect(json.conversation.title).toBe("Renamed Chat");
  });

  it("returns 404 when renaming non-existent conversation on PATCH /api/conversations/:id", async () => {
    const res = await executeRequest(server, {
      method: "PATCH",
      url: "/api/conversations/non-existent-id",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["developer"]),
      },
      body: { title: "Renamed Chat" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("executes AI test and persists messages when conversationId is provided", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/ai/test",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["developer"]),
      },
      body: { prompt: "Save my chat", conversationId: "conv-mock-123" },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as Record<string, unknown>;
    expect(json.result).toContain("Connection test successful for: Save my chat");
    expect(json.conversationId).toBe("conv-mock-123");
  });

  it("serves Prometheus metrics on GET /metrics", async () => {
    const res = await executeRequest(server, { url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("http_requests_total");
    expect(res.body).toContain("nodejs_");
  });

  it("rejects request bodies exceeding 1MB with 413", async () => {
    // 1 MB + 10 bytes
    const hugeBody = "x".repeat(1024 * 1024 + 10);
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/conversations",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["developer"]),
      },
      body: hugeBody,
    });
    expect(res.statusCode).toBe(413);
  });

  it("rejects empty conversation title on POST /api/conversations with 400", async () => {
    const res = await executeRequest(server, {
      method: "POST",
      url: "/api/conversations",
      headers: {
        "content-type": "application/json",
        "x-user-roles": JSON.stringify(["developer"]),
      },
      body: { title: "   " },
    });
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body) as Record<string, unknown>;
    expect(json.error).toBe("Title must not be empty.");
  });

  it("propagates incoming W3C traceparent and returns x-trace-id header", async () => {
    const incomingTraceparent =
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const res = await executeRequest(server, {
      url: "/healthz",
      headers: {
        traceparent: incomingTraceparent,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-trace-id"]).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(res.headers["traceparent"]).toContain("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("generates a new traceId when no traceparent is provided", async () => {
    const res = await executeRequest(server, { url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-trace-id"]).toMatch(/^[0-9a-f]{32}$/);
    expect(res.headers["traceparent"]).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await executeRequest(server, { url: "/unknown-route" });
    expect(res.statusCode).toBe(404);
  });
});
