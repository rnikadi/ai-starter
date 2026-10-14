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
      url: process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || "/",
      description: process.env.NODE_ENV === "production" ? "Production API server" : "API server",
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
    "/api/conversations": {
      get: {
        summary: "List user conversations",
        description: "Returns all conversations belonging to the authenticated user.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "List of conversations",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConversationListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        summary: "Create a new conversation",
        description: "Creates an empty conversation thread for the authenticated user.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateConversationRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Conversation created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConversationDetailResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/conversations/{id}": {
      get: {
        summary: "Get conversation metadata",
        description: "Returns conversation metadata by ID for the authenticated owner.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Conversation UUID",
          },
        ],
        responses: {
          "200": {
            description: "Conversation found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConversationDetailResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        summary: "Delete a conversation",
        description: "Permanently deletes a conversation and all its messages.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Conversation UUID",
          },
        ],
        responses: {
          "200": {
            description: "Conversation deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/conversations/{id}/messages": {
      get: {
        summary: "List conversation messages",
        description: "Returns all messages within a conversation thread in chronological order.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Conversation UUID",
          },
        ],
        responses: {
          "200": {
            description: "Chronological list of conversation messages",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConversationMessagesResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/ai/test": {
      post: {
        summary: "Execute AI agent prompt",
        description:
          "Executes the Mastra connection test agent against the Archestra LLM gateway. Requires 'developer' or 'admin' role. Optionally persists into a conversation thread if conversationId is provided.",
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
          "404": { $ref: "#/components/responses/NotFound" },
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
                },
              },
            },
          },
        },
      },
      Conversation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string" },
          title: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          conversationId: { type: "string", format: "uuid" },
          role: { type: "string", enum: ["user", "assistant", "system"] },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateConversationRequest: {
        type: "object",
        properties: {
          title: {
            type: "string",
            example: "Architecture discussion",
            description: "Optional conversation title (default: New Conversation)",
          },
        },
      },
      ConversationListResponse: {
        type: "object",
        properties: {
          conversations: {
            type: "array",
            items: { $ref: "#/components/schemas/Conversation" },
          },
        },
      },
      ConversationDetailResponse: {
        type: "object",
        properties: {
          conversation: { $ref: "#/components/schemas/Conversation" },
        },
      },
      ConversationMessagesResponse: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            items: { $ref: "#/components/schemas/Message" },
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
          conversationId: {
            type: "string",
            format: "uuid",
            description: "Optional conversation UUID to persist user prompt and AI response",
            example: "123e4567-e89b-12d3-a456-426614174000",
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
          conversationId: {
            type: "string",
            format: "uuid",
            description: "Persisted conversation UUID if provided in request",
          },
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
      NotFound: {
        description: "Resource not found",
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
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Starter Backend API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.18.2/favicon-32x32.png" sizes="32x32" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin: 0;
      background: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .topbar {
      display: none !important;
    }
    .swagger-ui .info {
      margin: 28px 0;
    }
    .swagger-ui .info .title {
      font-size: 28px;
    }
  </style>
</head>
<body>
  <noscript>
    <div style="padding: 24px; font-family: sans-serif;">
      <h2>AI Starter Backend API</h2>
      <p>Interactive Swagger UI requires JavaScript. Key endpoints: <code>/healthz</code>, <code>/readyz</code>, <code>/openapi.json</code>, <code>/api/ai/test</code>, <code>/api/conversations</code>.</p>
      <p>Download the raw specification: <a href="/openapi.json">/openapi.json</a></p>
    </div>
  </noscript>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js" crossorigin="anonymous"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>`;
}
