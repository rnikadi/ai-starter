export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "AI Starter Backend API",
    version: "0.1.0",
    description:
      "Reusable, generic backend API for AI applications with Keycloak OIDC authentication, RBAC, Mastra agents, and Archestra LLM gateway.",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local development server",
    },
  ],
  paths: {
    "/healthz": {
      get: {
        summary: "Liveness probe",
        description:
          "Checks if the backend process is running and returns basic uptime and memory statistics.",
        responses: {
          "200": {
            description: "Process is live and healthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
                },
              },
            },
          },
        },
      },
    },
    "/readyz": {
      get: {
        summary: "Readiness probe",
        description:
          "Checks if downstream dependencies (Keycloak OIDC and Archestra LLM gateway) are reachable.",
        responses: {
          "200": {
            description: "All downstream dependencies are ready",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ReadyResponse",
                },
              },
            },
          },
          "503": {
            description: "One or more dependencies are unreachable",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ReadyResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/admin/status": {
      get: {
        summary: "Admin capability check",
        description: "Requires JWT Bearer token with realm role 'admin'.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Admin capability confirmed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    authenticated: { type: "boolean" },
                    authorized: { type: "boolean" },
                    capabilities: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/ai/test": {
      post: {
        summary: "Execute AI agent prompt",
        description:
          "Executes the Mastra connection test agent against the Archestra LLM gateway. Requires 'developer' or 'admin' role.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AiTestRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Agent execution successful",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AiTestResponse",
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "502": { $ref: "#/components/responses/BadGateway" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Keycloak OIDC Access Token",
      },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "healthy" },
          service: { type: "string", example: "ai-starter-backend" },
          uptimeSeconds: { type: "number", example: 120.5 },
          timestamp: { type: "string", format: "date-time" },
          node: { type: "string", example: "v24.20.0" },
          memory: {
            type: "object",
            properties: {
              heapUsedMb: { type: "number", example: 25.4 },
              rssMb: { type: "number", example: 52.1 },
            },
          },
        },
      },
      ReadyResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ready" },
          timestamp: { type: "string", format: "date-time" },
          checks: {
            type: "object",
            properties: {
              keycloak: {
                type: "object",
                properties: {
                  status: { type: "string", example: "up" },
                  latencyMs: { type: "number", example: 12 },
                  url: { type: "string" },
                },
              },
              archestra: {
                type: "object",
                properties: {
                  status: { type: "string", example: "up" },
                  latencyMs: { type: "number", example: 8 },
                  url: { type: "string" },
                  mocked: { type: "boolean" },
                },
              },
            },
          },
        },
      },
      AiTestRequest: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: {
            type: "string",
            description: "Prompt to execute against Mastra agent",
            example: "Say hello and confirm AI connectivity",
          },
        },
      },
      AiTestResponse: {
        type: "object",
        properties: {
          result: {
            type: "string",
            example: "AI connection confirmed successfully.",
          },
          mocked: { type: "boolean", example: false },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
    responses: {
      BadRequest: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Unauthorized: {
        description: "Authentication is required",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Forbidden: {
        description: "Insufficient realm roles",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      TooManyRequests: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                retryAfterSeconds: { type: "number" },
              },
            },
          },
        },
      },
      BadGateway: {
        description: "Downstream LLM gateway error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
    },
  },
};

export function renderDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Starter Backend API Documentation</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --code-bg: #0b1120;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    header { margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
    h1 { font-size: 2rem; color: var(--primary); margin-bottom: 0.5rem; }
    p.lead { color: var(--text-muted); font-size: 1.1rem; }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: bold;
      text-transform: uppercase;
      margin-right: 0.5rem;
    }
    .badge-get { background: #0284c7; color: white; }
    .badge-post { background: #16a34a; color: white; }
    .spec-link {
      display: inline-block;
      margin-top: 1rem;
      color: var(--primary);
      text-decoration: none;
      font-size: 0.9rem;
      border: 1px solid var(--border);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
    }
    .spec-link:hover { background: var(--card-bg); }
    .endpoint {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    .endpoint-header {
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border);
    }
    .path { font-family: monospace; font-size: 1.1rem; font-weight: 600; }
    .desc { color: var(--text-muted); font-size: 0.95rem; }
    .endpoint-body { padding: 1.25rem; font-size: 0.9rem; }
    .section-title { font-weight: 600; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; margin-bottom: 0.5rem; letter-spacing: 0.05em; }
    pre {
      background: var(--code-bg);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      border: 1px solid var(--border);
      margin-top: 0.5rem;
      color: #e2e8f0;
    }
    .tag {
      font-size: 0.75rem;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      background: #334155;
      color: #cbd5e1;
      margin-left: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>AI Starter Backend API</h1>
      <p class="lead">Interactive reference for backend endpoints, authentication, and health probes.</p>
      <a class="spec-link" href="/openapi.json" target="_blank">View Raw OpenAPI 3.1 Specification JSON &rarr;</a>
    </header>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="badge badge-get">GET</span>
        <span class="path">/healthz</span>
        <span class="tag">Liveness</span>
      </div>
      <div class="endpoint-body">
        <p class="desc">Process liveness check returning uptime, memory, and Node version.</p>
        <div class="section-title" style="margin-top: 1rem;">Example Response (200 OK)</div>
        <pre><code>{
  "status": "healthy",
  "service": "ai-starter-backend",
  "uptimeSeconds": 45.2,
  "timestamp": "2026-10-14T14:30:00.000Z",
  "node": "v24.20.0",
  "memory": { "heapUsedMb": 24.5, "rssMb": 51.2 }
}</code></pre>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="badge badge-get">GET</span>
        <span class="path">/readyz</span>
        <span class="tag">Readiness</span>
      </div>
      <div class="endpoint-body">
        <p class="desc">Dependency readiness check for Keycloak OIDC (:8080) and Archestra LLM Gateway (:9000).</p>
        <div class="section-title" style="margin-top: 1rem;">Example Response (200 OK)</div>
        <pre><code>{
  "status": "ready",
  "timestamp": "2026-10-14T14:30:00.000Z",
  "checks": {
    "keycloak": { "status": "up", "latencyMs": 14 },
    "archestra": { "status": "up", "latencyMs": 9 }
  }
}</code></pre>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="badge badge-get">GET</span>
        <span class="path">/api/admin/status</span>
        <span class="tag">Role: admin</span>
      </div>
      <div class="endpoint-body">
        <p class="desc">Verifies administrator capabilities via JWT Bearer token.</p>
        <div class="section-title" style="margin-top: 1rem;">Required Header</div>
        <pre><code>Authorization: Bearer &lt;keycloak-access-token&gt;</code></pre>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="badge badge-post">POST</span>
        <span class="path">/api/ai/test</span>
        <span class="tag">Role: developer | admin</span>
      </div>
      <div class="endpoint-body">
        <p class="desc">Executes Mastra Agent against Archestra gateway (or simulated in mock mode). Rate limited to 20 req/min.</p>
        <div class="section-title" style="margin-top: 1rem;">Request Body (JSON)</div>
        <pre><code>{
  "prompt": "Say hello and confirm AI connectivity"
}</code></pre>
        <div class="section-title" style="margin-top: 1rem;">Response (200 OK)</div>
        <pre><code>{
  "result": "AI connection confirmed successfully.",
  "mocked": false
}</code></pre>
      </div>
    </div>
  </div>
</body>
</html>`;
}

