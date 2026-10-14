import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getFrontendEnv: () => ({
    BACKEND_URL: "http://localhost:4000",
    AUTH_URL: "http://localhost:3001",
    AUTH_SECRET: "test-secret",
    AUTH_KEYCLOAK_ID: "ai-starter-web",
    AUTH_KEYCLOAK_SECRET: "test-secret",
    AUTH_KEYCLOAK_ISSUER: "http://localhost:8080/realms/ai-starter",
  }),
}));

import { auth } from "@/auth";
import { POST } from "./route.js";

describe("Frontend AI Test Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as unknown as never);

    const req = new Request("http://localhost:3001/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Authentication is required.");
  });

  it("returns 400 when request body is not valid JSON", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { name: "Developer", email: "dev@example.com", roles: ["developer"] },
    } as unknown as never);

    const req = new Request("http://localhost:3001/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Request body must be valid JSON.");
  });
});

