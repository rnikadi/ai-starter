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

  it("returns 404 for unknown routes", async () => {
    const res = await executeRequest(server, { url: "/unknown-route" });
    expect(res.statusCode).toBe(404);
  });
});
